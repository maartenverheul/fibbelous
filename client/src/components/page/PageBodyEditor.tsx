import { BlockNoteView } from "@blocknote/ariakit";
import "@blocknote/ariakit/style.css";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import {
  getDefaultReactSlashMenuItems,
  GridSuggestionMenuController,
  SideMenuController,
  SuggestionMenuController,
  useCreateBlockNote,
  useEditorChange,
} from "@blocknote/react";
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import { useTabs } from "../../context/TabContext";
import { useWorkspacePages } from "../../hooks/useWorkspacePages";
import { insertBookmarkBlock } from "../../lib/editor/blocks/bookmark";
import { insertDatabaseBlock } from "../../lib/editor/blocks/database";
import {
  htmlToMarkdown,
  markdownToHtml,
} from "../../lib/editor/markdownPipeline";
import { insertMapsBlock } from "../../lib/editor/blocks/maps";
import { insertCalloutSlashMenuItem } from "../../lib/editor/slash/callout";
import { insertDatabasePageSlashMenuItem } from "../../lib/editor/slash/database";
import { insertInlineDatabaseSlashMenuItem } from "../../lib/editor/slash/inlineDatabase";
import { insertMapsSlashMenuItem } from "../../lib/editor/slash/maps";
import type { PageEditor } from "../../lib/editor/schema";
import { pageEditorSchema } from "../../lib/editor/schema";
import { PageEditorSideMenu } from "../../lib/editor/sideMenu";
import { insertNewPageSlashMenuItem } from "../../lib/editor/slash/page";
import { insertTocSlashMenuItem } from "../../lib/editor/slash/toc";
import { getMentionMenuItems } from "../../lib/editor/mentionMenu";
import {
  focusEditorDocumentStart,
  isCursorAtDocumentStart,
  placeEditorCursorAtDocumentStart,
} from "../../lib/editor/titleBodyKeyboard";
import {
  internalPageLinksToMarkers,
  isExternalLink,
  isInternalPageLink,
  isValidEditorLink,
  normalizePageHref,
  pageIdFromInternalLink,
  pageLinkFilename,
  pageLinkMarkersToAnchors,
  type PageLinkMeta,
} from "../../lib/editor/pageLinks";
import { mentionDateMarkersToMdxTags } from "../../lib/editor/mentionDate";
import {
  getPasteLinkChoiceOptions,
  insertPastedInlineLink,
  insertPastedPlainText,
  shouldOfferPasteLinkChoice,
} from "../../lib/editor/pasteLinkChoice";
import { openExternalUrl } from "../../lib/api/tauri";
import { cn } from "../../lib/utils";
import {
  buildPageSegment,
  pageLabel,
  type ReferencedPage,
} from "../../lib/page/types";
import type { WorkspaceDatabaseMeta } from "../../lib/database/types";
import {
  PasteLinkChoiceMenu,
  type PasteLinkChoice,
} from "./PasteLinkChoiceMenu";
import {
  InlineDatabaseChoiceMenu,
  type InlineDatabaseChoice,
} from "./InlineDatabaseChoiceMenu";
import {
  InlineDatabasePickerMenu,
  type InlineDatabasePickerAnchor,
} from "./InlineDatabasePickerMenu";

export type PageBodyEditorHandle = {
  focusStart: () => void;
};

type PageBodyEditorProps = {
  pageId: string;
  body: string;
  readOnly: boolean;
  referencedPages?: ReferencedPage[];
  onBodyChange: (value: string) => void;
  /** Backspace at the start of the document should move focus to the title. */
  onExitToTitle?: () => void;
};

const SERIALIZE_DEBOUNCE_MS = 150;

function buildReferencedPageLookup(referencedPages: ReferencedPage[]) {
  const byId = new Map<string, PageLinkMeta>();
  const byLink = new Map<string, PageLinkMeta>();

  for (const page of referencedPages) {
    const meta: PageLinkMeta = {
      id: page.id,
      name: page.name,
      icon: page.icon,
      // Stored in MDX as basename; `page.link` is the resolved workspace path.
      link: pageLinkFilename(page.link),
    };
    byId.set(page.id, meta);
    byLink.set(normalizePageHref(page.link), meta);
    byLink.set(pageLinkFilename(page.link), meta);
  }

  return { byId, byLink };
}

async function parseBodyToBlocks(
  editor: PageEditor,
  body: string,
  resolvePageLink: (href: string, pageId: string) => PageLinkMeta | undefined,
) {
  if (!body.trim()) {
    return [{ type: "paragraph" as const, content: [] }];
  }

  const html = await markdownToHtml(body);
  const withPageLinks = internalPageLinksToMarkers(html, resolvePageLink);
  return editor.tryParseHTMLToBlocks(withPageLinks);
}

async function serializeBody(editor: PageEditor): Promise<string> {
  // BlockNote's markdown exporter strips unknown tags; go HTML → markdown so
  // custom MDX tags (`<Database />`, `<Bookmark />`, `<Callout />`, …) survive.
  const html = mentionDateMarkersToMdxTags(
    pageLinkMarkersToAnchors(editor.blocksToHTMLLossy()),
  );
  return htmlToMarkdown(html);
}

function getSlashMenuItems(
  editor: PageEditor,
  options: {
    page: Parameters<typeof insertNewPageSlashMenuItem>[1];
    database: Parameters<typeof insertDatabasePageSlashMenuItem>[1];
    inlineDatabase: Parameters<typeof insertInlineDatabaseSlashMenuItem>[1];
  },
) {
  const items = [
    ...getDefaultReactSlashMenuItems(editor),
    insertNewPageSlashMenuItem(editor, options.page),
    insertDatabasePageSlashMenuItem(editor, options.database),
    insertInlineDatabaseSlashMenuItem(editor, options.inlineDatabase),
    insertMapsSlashMenuItem(editor),
    insertTocSlashMenuItem(editor),
    insertCalloutSlashMenuItem(editor),
  ];

  // BlockNote shows a section title whenever `group` changes, so keep items
  // with the same group contiguous (defaults end with Media/Others; our
  // custom Media/Others items would otherwise reopen those sections).
  const groupOrder: string[] = [];
  const byGroup = new Map<string, typeof items>();
  for (const item of items) {
    const group = item.group ?? "";
    let bucket = byGroup.get(group);
    if (!bucket) {
      bucket = [];
      byGroup.set(group, bucket);
      groupOrder.push(group);
    }
    bucket.push(item);
  }
  return groupOrder.flatMap((group) => byGroup.get(group)!);
}

export const PageBodyEditor = forwardRef<
  PageBodyEditorHandle,
  PageBodyEditorProps
>(function PageBodyEditor(
  {
    pageId,
    body,
    readOnly,
    referencedPages = [],
    onBodyChange,
    onExitToTitle,
  },
  ref,
) {
  const { navigateInTab } = useTabs();
  const {
    createPage,
    createDatabase,
    listDatabases,
    findPageById,
    searchPages,
    favoritePages,
    rootPages,
  } = useWorkspacePages();
  const findPageByIdRef = useRef(findPageById);
  const createPageRef = useRef(createPage);
  const createDatabaseRef = useRef(createDatabase);
  const listDatabasesRef = useRef(listDatabases);
  const searchPagesRef = useRef(searchPages);
  const favoritePagesRef = useRef(favoritePages);
  const rootPagesRef = useRef(rootPages);
  const navigateInTabRef = useRef(navigateInTab);
  const onExitToTitleRef = useRef(onExitToTitle);
  const openPasteChoiceRef = useRef<(choice: PasteLinkChoice) => void>(
    () => {},
  );
  const openInlineDbChoiceRef = useRef<(choice: InlineDatabaseChoice) => void>(
    () => {},
  );
  const pendingFocusStartRef = useRef(false);

  findPageByIdRef.current = findPageById;
  createPageRef.current = createPage;
  createDatabaseRef.current = createDatabase;
  listDatabasesRef.current = listDatabases;
  searchPagesRef.current = searchPages;
  favoritePagesRef.current = favoritePages;
  rootPagesRef.current = rootPages;
  navigateInTabRef.current = navigateInTab;
  onExitToTitleRef.current = onExitToTitle;

  const referencedLookup = useMemo(
    () => buildReferencedPageLookup(referencedPages),
    [referencedPages],
  );
  const referencedLookupRef = useRef(referencedLookup);
  referencedLookupRef.current = referencedLookup;
  const referencedKey = useMemo(
    () =>
      referencedPages
        .map((page) => `${page.id}:${page.name}:${page.icon ?? ""}:${page.link}`)
        .join("|"),
    [referencedPages],
  );

  const resolvePageLink = useCallback(
    (href: string, targetPageId: string): PageLinkMeta | undefined => {
      const lookup = referencedLookupRef.current;
      const fromRef =
        lookup.byLink.get(normalizePageHref(href)) ??
        lookup.byId.get(targetPageId);
      if (fromRef) return fromRef;

      const page = findPageByIdRef.current(targetPageId);
      if (!page) return undefined;

      return {
        id: page.id,
        name: pageLabel(page),
        icon: page.icon,
        link: pageLinkFilename(page.path),
      };
    },
    [],
  );

  const [pasteChoice, setPasteChoice] = useState<PasteLinkChoice | null>(null);
  openPasteChoiceRef.current = setPasteChoice;

  const [inlineDbChoice, setInlineDbChoice] =
    useState<InlineDatabaseChoice | null>(null);
  openInlineDbChoiceRef.current = setInlineDbChoice;

  const [inlineDbPicker, setInlineDbPicker] =
    useState<InlineDatabasePickerAnchor | null>(null);
  const [inlineDbList, setInlineDbList] = useState<WorkspaceDatabaseMeta[]>([]);
  const [inlineDbLoading, setInlineDbLoading] = useState(false);
  const [inlineDbError, setInlineDbError] = useState<string | null>(null);

  const editor = useCreateBlockNote(
    {
      schema: pageEditorSchema,
      links: {
        isValidLink: isValidEditorLink,
        onClick: (event) => {
          const anchor = (event.target as HTMLElement).closest("a");
          const href = anchor?.getAttribute("href");
          if (!href) return;

          // Custom pageLink inline handles its own navigation.
          if (anchor?.classList.contains("bn-page-link")) return;

          if (isInternalPageLink(href)) {
            event.preventDefault();
            const targetId = pageIdFromInternalLink(href);
            const page = targetId
              ? findPageByIdRef.current(targetId)
              : undefined;
            if (!page) return;

            navigateInTabRef.current(
              buildPageSegment(page, findPageByIdRef.current),
              {
                label: pageLabel(page),
                icon: page.icon,
                pageId: page.id,
              },
            );
            return;
          }

          if (isExternalLink(href)) {
            event.preventDefault();
            void openExternalUrl(href);
          }
        },
      },
      pasteHandler: ({ event, editor: pasteEditor, defaultPasteHandler }) => {
        const rawText = event.clipboardData?.getData("text/plain") ?? "";

        // Ctrl+Shift+V / Cmd+Shift+V — always paste as plain text.
        if ("shiftKey" in event && event.shiftKey) {
          if (rawText) {
            pasteEditor.pasteText(rawText);
            return true;
          }
          return defaultPasteHandler({ plainTextAsMarkdown: false });
        }

        const text = rawText.trim();
        if (!shouldOfferPasteLinkChoice(pasteEditor as PageEditor, text)) {
          return defaultPasteHandler();
        }

        const options = getPasteLinkChoiceOptions(text);
        if (!options) return defaultPasteHandler();

        const box = pasteEditor.getSelectionBoundingBox();
        openPasteChoiceRef.current({
          url: text,
          left: box?.left ?? 16,
          top: (box?.bottom ?? 16) + 6,
          ...options,
        });
        return true;
      },
    },
    [pageId],
  );
  const [ready, setReady] = useState(false);
  const isProgrammaticRef = useRef(false);
  const userEditedRef = useRef(false);
  const appliedBodyRef = useRef<string | null>(null);
  const serializeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onBodyChangeRef = useRef(onBodyChange);

  onBodyChangeRef.current = onBodyChange;

  const focusStart = useCallback(() => {
    if (!ready) {
      pendingFocusStartRef.current = true;
      return;
    }
    focusEditorDocumentStart(editor);
  }, [editor, ready]);

  useImperativeHandle(ref, () => ({ focusStart }), [focusStart]);

  useEffect(() => {
    if (!ready || !pendingFocusStartRef.current) return;
    pendingFocusStartRef.current = false;
    focusEditorDocumentStart(editor);
  }, [ready, editor]);

  useEffect(() => {
    if (readOnly) return;
    const el = editor.domElement;
    if (!el) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Backspace" ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }
      if (!isCursorAtDocumentStart(editor)) return;

      event.preventDefault();
      event.stopPropagation();
      onExitToTitleRef.current?.();
    };

    el.addEventListener("keydown", onKeyDown, true);
    return () => el.removeEventListener("keydown", onKeyDown, true);
  }, [editor, readOnly, ready]);

  const pasteChoiceRef = useRef(pasteChoice);
  pasteChoiceRef.current = pasteChoice;

  const applyPasteAsPlainText = useCallback(() => {
    const choice = pasteChoiceRef.current;
    if (!choice) return;
    setPasteChoice(null);
    insertPastedPlainText(editor, choice.url);
    editor.focus();
  }, [editor]);

  const applyPasteAsLink = useCallback(() => {
    const choice = pasteChoiceRef.current;
    if (!choice) return;
    setPasteChoice(null);
    insertPastedInlineLink(editor, choice.url);
    editor.focus();
  }, [editor]);

  const applyPasteAsBookmark = useCallback(() => {
    const choice = pasteChoiceRef.current;
    if (!choice) return;
    setPasteChoice(null);
    insertBookmarkBlock(editor, choice.url);
    editor.focus();
  }, [editor]);

  const applyPasteAsMaps = useCallback(() => {
    const choice = pasteChoiceRef.current;
    if (!choice) return;
    setPasteChoice(null);
    insertMapsBlock(editor, choice.url);
    editor.focus();
  }, [editor]);

  const dismissInlineDbMenus = useCallback(() => {
    setInlineDbChoice(null);
    setInlineDbPicker(null);
    setInlineDbList([]);
    setInlineDbError(null);
    setInlineDbLoading(false);
  }, []);

  const applyInlineDbNew = useCallback(() => {
    const choice = inlineDbChoice;
    setInlineDbChoice(null);
    void (async () => {
      try {
        const result = await createDatabaseRef.current();
        insertDatabaseBlock(editor, result.database.id);
        editor.focus();
      } catch (error) {
        console.error(error);
        if (choice) setInlineDbChoice(choice);
      }
    })();
  }, [editor, inlineDbChoice]);

  const openInlineDbExisting = useCallback(() => {
    const choice = inlineDbChoice;
    if (!choice) return;
    setInlineDbChoice(null);
    setInlineDbPicker({ left: choice.left, top: choice.top });
    setInlineDbLoading(true);
    setInlineDbError(null);
    void (async () => {
      try {
        const databases = await listDatabasesRef.current();
        setInlineDbList(databases);
      } catch (error) {
        console.error(error);
        setInlineDbError(
          error instanceof Error ? error.message : "Failed to list databases",
        );
      } finally {
        setInlineDbLoading(false);
      }
    })();
  }, [inlineDbChoice]);

  const applyInlineDbExisting = useCallback(
    (database: WorkspaceDatabaseMeta) => {
      setInlineDbPicker(null);
      setInlineDbList([]);
      insertDatabaseBlock(editor, database.id);
      editor.focus();
    },
    [editor],
  );

  useEffect(() => {
    setPasteChoice(null);
    dismissInlineDbMenus();
  }, [pageId, dismissInlineDbMenus]);

  useEffect(() => {
    const applyKey = `${body}\0${referencedKey}`;
    if (userEditedRef.current || appliedBodyRef.current === applyKey) {
      return;
    }

    let cancelled = false;
    setReady(false);
    isProgrammaticRef.current = true;

    void (async () => {
      try {
        const blocks = await parseBodyToBlocks(editor, body, resolvePageLink);
        if (cancelled) return;

        const nextBlocks =
          blocks.length > 0
            ? blocks
            : [{ type: "paragraph" as const, content: [] }];

        editor.replaceBlocks(editor.document, nextBlocks);
        placeEditorCursorAtDocumentStart(editor);
        appliedBodyRef.current = applyKey;
      } catch (error) {
        console.error("Failed to load page body into editor", error);
      } finally {
        if (!cancelled) {
          isProgrammaticRef.current = false;
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (serializeTimerRef.current) {
        clearTimeout(serializeTimerRef.current);
        serializeTimerRef.current = null;
      }
    };
  }, [body, editor, pageId, resolvePageLink, referencedKey]);

  useEditorChange(() => {
    if (!ready || isProgrammaticRef.current || readOnly) {
      return;
    }

    userEditedRef.current = true;

    if (serializeTimerRef.current) {
      clearTimeout(serializeTimerRef.current);
    }

    serializeTimerRef.current = setTimeout(() => {
      serializeTimerRef.current = null;

      void (async () => {
        try {
          const markdown = await serializeBody(editor);
          onBodyChangeRef.current(markdown);
        } catch (error) {
          console.error("Failed to serialize page body", error);
        }
      })();
    }, SERIALIZE_DEBOUNCE_MS);
  }, editor);

  return (
    <div
      className={cn("page-body-editor min-h-6", !ready && "opacity-0")}
      aria-busy={!ready}
    >
      <BlockNoteView
        editor={editor}
        editable={!readOnly}
        slashMenu={false}
        sideMenu={false}
        emojiPicker={false}
        aria-label="Page content"
        className="[&_.bn-editor]:min-h-6"
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) =>
            filterSuggestionItems(
              getSlashMenuItems(editor, {
                page: {
                  createPage: (parent) => createPageRef.current(parent),
                  getParentPage: () => findPageByIdRef.current(pageId),
                  flushBody: (markdown) => {
                    userEditedRef.current = true;
                    if (serializeTimerRef.current) {
                      clearTimeout(serializeTimerRef.current);
                      serializeTimerRef.current = null;
                    }
                    onBodyChangeRef.current(markdown);
                  },
                },
                database: {
                  createDatabase: (opts) => createDatabaseRef.current(opts),
                  getParentPage: () => findPageByIdRef.current(pageId),
                  flushBody: (markdown) => {
                    userEditedRef.current = true;
                    if (serializeTimerRef.current) {
                      clearTimeout(serializeTimerRef.current);
                      serializeTimerRef.current = null;
                    }
                    onBodyChangeRef.current(markdown);
                  },
                },
                inlineDatabase: {
                  openChoiceMenu: (anchor) =>
                    openInlineDbChoiceRef.current(anchor),
                },
              }),
              query,
            )
          }
        />
        <SuggestionMenuController
          triggerCharacter="@"
          getItems={async (query) =>
            getMentionMenuItems(editor, query, {
              searchPages: (q) => searchPagesRef.current(q),
              getSuggestedPages: () => {
                const favorites = favoritePagesRef.current ?? [];
                if (favorites.length > 0) return favorites;
                return rootPagesRef.current ?? [];
              },
            })
          }
        />
        {/* Default `:` emoji picker steals the colon from `@today 14:00`. */}
        <GridSuggestionMenuController
          triggerCharacter=":"
          columns={10}
          minQueryLength={2}
          shouldOpen={(tr) => {
            const pos = tr.selection.from;
            if (pos <= 0) return true;
            const before = tr.doc.textBetween(pos - 1, pos);
            return !/\d/.test(before);
          }}
        />
        <SideMenuController sideMenu={PageEditorSideMenu} />
      </BlockNoteView>
      {pasteChoice && !readOnly && (
        <PasteLinkChoiceMenu
          choice={pasteChoice}
          onPlainText={applyPasteAsPlainText}
          onLink={applyPasteAsLink}
          onBookmark={applyPasteAsBookmark}
          onMaps={applyPasteAsMaps}
          onDismiss={applyPasteAsPlainText}
        />
      )}
      {inlineDbChoice && !readOnly && (
        <InlineDatabaseChoiceMenu
          choice={inlineDbChoice}
          onNew={applyInlineDbNew}
          onExisting={openInlineDbExisting}
          onDismiss={dismissInlineDbMenus}
        />
      )}
      {inlineDbPicker && !readOnly && (
        <InlineDatabasePickerMenu
          anchor={inlineDbPicker}
          databases={inlineDbList}
          loading={inlineDbLoading}
          error={inlineDbError}
          onSelect={applyInlineDbExisting}
          onDismiss={dismissInlineDbMenus}
        />
      )}
    </div>
  );
});
