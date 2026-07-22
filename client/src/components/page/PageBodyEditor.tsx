import type { BlockNoteEditor } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/ariakit";
import "@blocknote/ariakit/style.css";
import {
  useCreateBlockNote,
  useEditorChange,
} from "@blocknote/react";
import { useEffect, useRef, useState } from "react";
import { useTabs } from "../../context/TabContext";
import { useWorkspacePages } from "../../hooks/useWorkspacePages";
import { markdownToHtml } from "../../lib/markdownPipeline";
import {
  isExternalLink,
  isInternalPageLink,
  isValidEditorLink,
  pageIdFromInternalLink,
} from "../../lib/pageLinks";
import { cn } from "../../lib/utils";
import { buildPageSegment, pageLabel } from "../../types/page";

type PageBodyEditorProps = {
  pageId: string;
  body: string;
  readOnly: boolean;
  onBodyChange: (value: string) => void;
};

const SERIALIZE_DEBOUNCE_MS = 150;

async function parseBodyToBlocks(editor: BlockNoteEditor, body: string) {
  if (!body.trim()) {
    return [{ type: "paragraph" as const, content: [] }];
  }

  const html = await markdownToHtml(body);
  return editor.tryParseHTMLToBlocks(html);
}

export function PageBodyEditor({
  pageId,
  body,
  readOnly,
  onBodyChange,
}: PageBodyEditorProps) {
  const { navigateInTab } = useTabs();
  const { findPageById } = useWorkspacePages();
  const findPageByIdRef = useRef(findPageById);
  const navigateInTabRef = useRef(navigateInTab);

  findPageByIdRef.current = findPageById;
  navigateInTabRef.current = navigateInTab;

  const editor = useCreateBlockNote(
    {
      links: {
        isValidLink: isValidEditorLink,
        onClick: (event) => {
          const anchor = (event.target as HTMLElement).closest("a");
          const href = anchor?.getAttribute("href");
          if (!href) return;

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
            window.open(href, "_blank", "noopener,noreferrer");
          }
        },
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

  useEffect(() => {
    if (userEditedRef.current || appliedBodyRef.current === body) {
      return;
    }

    let cancelled = false;
    setReady(false);
    isProgrammaticRef.current = true;

    void (async () => {
      try {
        const blocks = await parseBodyToBlocks(editor, body);
        if (cancelled) return;

        const nextBlocks =
          blocks.length > 0
            ? blocks
            : [{ type: "paragraph" as const, content: [] }];

        editor.replaceBlocks(editor.document, nextBlocks);
        appliedBodyRef.current = body;
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
  }, [body, editor, pageId]);

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

      try {
        const markdown = editor.blocksToMarkdownLossy();
        onBodyChangeRef.current(markdown);
      } catch (error) {
        console.error("Failed to serialize page body", error);
      }
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
        aria-label="Page content"
        className="[&_.bn-editor]:min-h-6"
      />
    </div>
  );
}
