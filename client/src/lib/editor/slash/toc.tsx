import { insertOrUpdateBlockForSlashMenu } from "@blocknote/core/extensions";
import type { DefaultReactSuggestionItem } from "@blocknote/react";
import { PiListBullets } from "react-icons/pi";
import type { PageEditor } from "../schema";
import { tocDefaultRaw } from "../blocks/toc";

/** Slash / + menu item that inserts a live table of contents block. */
export function insertTocSlashMenuItem(
  editor: PageEditor,
): DefaultReactSuggestionItem {
  return {
    title: "Table of contents",
    subtext: "Outline of headings on this page",
    aliases: ["toc", "contents", "outline", "headings"],
    group: "Others",
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
