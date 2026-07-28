import type { DefaultReactSuggestionItem } from "@blocknote/react";
import { PiDatabase } from "react-icons/pi";
import type { CreateDatabaseResult } from "../../database/types";
import type { WorkspacePage, WorkspacePageDetail } from "../../page/types";
import { pageLabel } from "../../page/types";
import { htmlToMarkdown } from "../markdownPipeline";
import type { PageEditor } from "../schema";
import { pageLinkFilename, pageLinkMarkersToAnchors } from "../pageLinks";
import { openWorkspacePage } from "../../page/navigate";

async function serializePageBody(editor: PageEditor): Promise<string> {
  const html = pageLinkMarkersToAnchors(editor.blocksToHTMLLossy());
  return htmlToMarkdown(html);
}

type InsertDatabasePageOptions = {
  createDatabase: (options: {
    parentId: string;
  }) => Promise<CreateDatabaseResult>;
  getParentPage: () => WorkspacePage | undefined;
  /** Persist the updated body before navigating away. */
  flushBody: (markdown: string) => void;
};

/** Slash menu item: create a full-page database child and link to it. */
export function insertDatabasePageSlashMenuItem(
  editor: PageEditor,
  options: InsertDatabasePageOptions,
): DefaultReactSuggestionItem {
  return {
    title: "Database",
    subtext: "Create a full-page database and link to it",
    aliases: ["database", "db", "table", "full page database"],
    group: "Pages",
    icon: <PiDatabase size={18} />,
    onItemClick: () => {
      void (async () => {
        const parent = options.getParentPage();
        if (!parent) return;

        try {
          const result = await options.createDatabase({ parentId: parent.id });
          const detail = result.page;
          if (!detail) {
            throw new Error("Database page was not created");
          }

          editor.insertInlineContent([
            {
              type: "pageLink",
              props: {
                href: pageLinkFilename(detail.path),
                pageId: detail.id,
                name: pageLabel(detail),
                icon: detail.icon ?? "",
              },
            },
          ]);

          const markdown = await serializePageBody(editor);
          options.flushBody(markdown);
          openWorkspacePage(detail as WorkspacePageDetail, {
            focusTitle: true,
          });
        } catch (error) {
          console.error(error);
        }
      })();
    },
  };
}
