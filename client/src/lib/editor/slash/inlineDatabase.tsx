import type { DefaultReactSuggestionItem } from "@blocknote/react";
import { PiTable } from "react-icons/pi";
import type { PageEditor } from "../schema";

export type InlineDatabaseMenuAnchor = {
  left: number;
  top: number;
};

type InsertInlineDatabaseOptions = {
  /** Open New vs Existing choice menu near the caret. */
  openChoiceMenu: (anchor: InlineDatabaseMenuAnchor) => void;
};

/** Slash menu item: embed a database inline (then pick new or existing). */
export function insertInlineDatabaseSlashMenuItem(
  editor: PageEditor,
  options: InsertInlineDatabaseOptions,
): DefaultReactSuggestionItem {
  return {
    title: "Inline database",
    subtext: "Embed a database in this page",
    aliases: [
      "inline database",
      "database",
      "db",
      "table",
      "embed database",
    ],
    group: "Others",
    icon: <PiTable size={18} />,
    onItemClick: () => {
      const box = editor.getSelectionBoundingBox();
      options.openChoiceMenu({
        left: box?.left ?? 16,
        top: (box?.bottom ?? 16) + 6,
      });
    },
  };
}
