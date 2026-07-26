import { insertOrUpdateBlockForSlashMenu } from "@blocknote/core/extensions";
import type { DefaultReactSuggestionItem } from "@blocknote/react";
import { PiMapTrifold } from "react-icons/pi";
import { mapsRawFromUrl } from "../blocks/maps";
import type { PageEditor } from "../schema";


/** Slash / + menu item that inserts an empty Maps block ready for a URL. */
export function insertMapsSlashMenuItem(
  editor: PageEditor,
): DefaultReactSuggestionItem {
  return {
    title: "Maps",
    subtext: "Embed a Google Maps link",
    aliases: ["map", "maps", "google maps", "location", "place", "embed"],
    group: "Media",
    icon: <PiMapTrifold size={18} />,
    onItemClick: () => {
      insertOrUpdateBlockForSlashMenu(editor, {
        type: "maps",
        props: {
          url: "",
          raw: mapsRawFromUrl(""),
        },
      });
    },
  };
}
