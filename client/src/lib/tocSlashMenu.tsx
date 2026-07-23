import { insertOrUpdateBlockForSlashMenu } from "@blocknote/core/extensions";
import type { DefaultReactSuggestionItem } from "@blocknote/react";
import { PiListBullets } from "react-icons/pi";
import type { PageEditor } from "./pageEditorSchema";
import { tocDefaultRaw } from "./tocBlock";

/** Slash / + menu item that inserts a live table of contents block. */
export function insertTocSlashMenuItem(
  editor: PageEditor,
): DefaultReactSuggestionItem {
  return {
    title: "Table of contents",
    subtext: "Outline of headings on this page",
    aliases: ["toc", "contents", "outline", "headings"],
    group: "Other",
    icon: <PiListBullets size={18} />,
    onItemClick: () => {
      insertOrUpdateBlockForSlashMenu(editor, {
        type: "toc",
        props: {
          raw: tocDefaultRaw(),
        },
      });
    },
  };
}
