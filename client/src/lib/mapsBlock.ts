import type { BlockNoteEditor } from "@blocknote/core";
import { elementToMdxTag, normalizeMapsInput } from "./mdxPlaceholders";

export function mapsRawFromUrl(url: string): string {
  const el = document.createElement("maps");
  if (url) {
    el.setAttribute("url", url);
  }
  return elementToMdxTag(el);
}

/** Commit a validated Maps URL. Returns false when the input is rejected. */
export function commitMapsUrl(
  editor: BlockNoteEditor<any, any, any>,
  blockId: string,
  url: string,
): boolean {
  const normalized = normalizeMapsInput(url);
  if (!normalized) return false;

  editor.updateBlock(blockId, {
    type: "maps",
    props: {
      url: normalized,
      raw: mapsRawFromUrl(normalized),
    },
  });
  return true;
}
