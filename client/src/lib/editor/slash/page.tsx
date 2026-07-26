import type { DefaultReactSuggestionItem } from "@blocknote/react";
import { PiFilePlus } from "react-icons/pi";
import type { WorkspacePage, WorkspacePageDetail } from "../../page/types";
import { pageLabel } from "../../page/types";
import { htmlToMarkdown } from "../markdownPipeline";
import type { PageEditor } from "../schema";
import { pageLinkMarkersToAnchors } from "../pageLinks";
import { openWorkspacePage } from "../../page/navigate";

async function serializePageBody(editor: PageEditor): Promise<string> {
  const html = pageLinkMarkersToAnchors(editor.blocksToHTMLLossy());
  return htmlToMarkdown(html);
}

type InsertNewPageOptions = {
  createPage: (parent: WorkspacePage) => Promise<WorkspacePageDetail>;
  getParentPage: () => WorkspacePage | undefined;
  /** Persist the updated body before navigating away. */
  flushBody: (markdown: string) => void;
};

/** Slash menu item that creates a subpage, links it at the cursor, and opens it. */
export function insertNewPageSlashMenuItem(
  editor: PageEditor,
  options: InsertNewPageOptions,
): DefaultReactSuggestionItem {
  return {
    title: "New page",
    subtext: "Create a page and link to it",
    aliases: ["page", "new page", "create page", "subpage", "link page"],
    group: "Pages",
    icon: <PiFilePlus size={18} />,
    onItemClick: () => {
      void (async () => {
        const parent = options.getParentPage();
        if (!parent) return;

        try {
          const detail = await options.createPage(parent);
          editor.insertInlineContent([
            {
              type: "pageLink",
              props: {
                href: detail.path,
                pageId: detail.id,
                name: pageLabel(detail),
                icon: detail.icon ?? "",
              },
            },
          ]);

          const markdown = await serializePageBody(editor);
          options.flushBody(markdown);
          openWorkspacePage(detail, { focusTitle: true });
        } catch (error) {
          console.error(error);
        }
      })();
    },
  };
}
