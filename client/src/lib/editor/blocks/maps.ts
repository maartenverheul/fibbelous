import type { BlockNoteEditor } from "@blocknote/core";
import { insertOrUpdateBlockForSlashMenu } from "@blocknote/core/extensions";
import { mdxRawWithAttrs, normalizeMapsInput } from "../mdxPlaceholders";

export function mapsRawFromUrl(url: string, existingRaw?: string): string {
  return mdxRawWithAttrs("maps", { url }, existingRaw);
}

/** Insert a Maps block for a validated maps URL or coordinates string. */
export function insertMapsBlock(
  editor: BlockNoteEditor<any, any, any>,
  input: string,
): boolean {
  const normalized = normalizeMapsInput(input);
  if (!normalized) return false;

  insertOrUpdateBlockForSlashMenu(editor, {
    type: "maps",
    props: {
      url: normalized,
      raw: mapsRawFromUrl(normalized),
    },
  });
  return true;
}

/** Commit a validated Maps URL. Returns false when the input is rejected. */
export function commitMapsUrl(
  editor: BlockNoteEditor<any, any, any>,
  blockId: string,
  url: string,
): boolean {
  const normalized = normalizeMapsInput(url);
  if (!normalized) return false;

  const existing = editor.getBlock(blockId);
  const existingRaw =
    existing && existing.type === "maps"
      ? String(existing.props.raw ?? "")
      : undefined;

  editor.updateBlock(blockId, {
    type: "maps",
    props: {
      url: normalized,
      raw: mapsRawFromUrl(normalized, existingRaw),
    },
  });
  return true;
}
