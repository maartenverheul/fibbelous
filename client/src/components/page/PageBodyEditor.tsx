import { BlockNoteView } from "@blocknote/ariakit";
import "@blocknote/ariakit/style.css";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import {
  getDefaultReactSlashMenuItems,
  SideMenuController,
  SuggestionMenuController,
  useCreateBlockNote,
  useEditorChange,
} from "@blocknote/react";
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import { useTabs } from "../../context/TabContext";
import { useWorkspacePages } from "../../hooks/useWorkspacePages";
import { insertBookmarkBlock } from "../../lib/editor/blocks/bookmark";
import {
  htmlToMarkdown,
  markdownToHtml,
} from "../../lib/editor/markdownPipeline";
import { insertMapsBlock } from "../../lib/editor/blocks/maps";
import { insertCalloutSlashMenuItem } from "../../lib/editor/slash/callout";
import { insertMapsSlashMenuItem } from "../../lib/editor/slash/maps";
import type { PageEditor } from "../../lib/editor/schema";
import { pageEditorSchema } from "../../lib/editor/schema";
import { PageEditorSideMenu } from "../../lib/editor/sideMenu";
import { insertNewPageSlashMenuItem } from "../../lib/editor/slash/page";
import { insertTocSlashMenuItem } from "../../lib/editor/slash/toc";
import {
  focusEditorDocumentStart,
  isCursorAtDocumentStart,
} from "../../lib/editor/titleBodyKeyboard";
import {
  internalPageLinksToMarkers,
  isExternalLink,
  isInternalPageLink,
  isValidEditorLink,
  normalizePageHref,
  pageIdFromInternalLink,
  pageLinkMarkersToAnchors,
  type PageLinkMeta,
} from "../../lib/editor/pageLinks";
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
import {
  PasteLinkChoiceMenu,
  type PasteLinkChoice,
} from "./PasteLinkChoiceMenu";

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
      link: page.link,
    };
    byId.set(page.id, meta);
    byLink.set(normalizePageHref(page.link), meta);
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
  const html = pageLinkMarkersToAnchors(editor.blocksToHTMLLossy());
  return htmlToMarkdown(html);
}

function getSlashMenuItems(
  editor: PageEditor,
  options: Parameters<typeof insertNewPageSlashMenuItem>[1],
) {
  return [
    ...getDefaultReactSlashMenuItems(editor),
    insertNewPageSlashMenuItem(editor, options),
    insertMapsSlashMenuItem(editor),
    insertTocSlashMenuItem(editor),
    insertCalloutSlashMenuItem(editor),
  ];
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
  const { createPage, findPageById } = useWorkspacePages();
  const findPageByIdRef = useRef(findPageById);
  const createPageRef = useRef(createPage);
  const navigateInTabRef = useRef(navigateInTab);
  const onExitToTitleRef = useRef(onExitToTitle);
  const openPasteChoiceRef = useRef<(choice: PasteLinkChoice) => void>(
    () => {},
  );
  const pendingFocusStartRef = useRef(false);

  findPageByIdRef.current = findPageById;
  createPageRef.current = createPage;
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
        link: page.path,
      };
    },
    [],
  );

  const [pasteChoice, setPasteChoice] = useState<PasteLinkChoice | null>(null);
  openPasteChoiceRef.current = setPasteChoice;

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

  useEffect(() => {
    setPasteChoice(null);
  }, [pageId]);

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
        aria-label="Page content"
        className="[&_.bn-editor]:min-h-6"
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) =>
            filterSuggestionItems(
              getSlashMenuItems(editor, {
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
              }),
              query,
            )
          }
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
    </div>
  );
});
