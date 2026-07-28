import { insertOrUpdateBlockForSlashMenu } from "@blocknote/core/extensions";
import type { DefaultReactSuggestionItem } from "@blocknote/react";
import { PiChatTeardropText } from "react-icons/pi";
import { CALLOUT_DEFAULT_ICON } from "../blocks/callout";
import type { PageEditor } from "../schema";

/** Slash / + menu item that inserts a Callout with the default lightbulb icon. */
export function insertCalloutSlashMenuItem(
  editor: PageEditor,
): DefaultReactSuggestionItem {
  return {
    title: "Callout",
    subtext: "Highlighted note with optional icon and color",
    aliases: ["callout", "note", "info", "warning", "tip", "highlight"],
    group: "Others",
    icon: <PiChatTeardropText size={18} />,
    onItemClick: () => {
      insertOrUpdateBlockForSlashMenu(editor, {
        type: "callout",
        props: {
          icon: CALLOUT_DEFAULT_ICON,
          color: "",
        },
      });
    },
  };
}
