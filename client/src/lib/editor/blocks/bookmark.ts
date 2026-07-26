import type { BlockNoteEditor } from "@blocknote/core";
import { insertOrUpdateBlockForSlashMenu } from "@blocknote/core/extensions";
import { mdxRawWithAttrs } from "../mdxPlaceholders";

export function bookmarkRawFromUrl(url: string, existingRaw?: string): string {
  return mdxRawWithAttrs("bookmark", { url }, existingRaw);
}

export function insertBookmarkBlock(
  editor: BlockNoteEditor<any, any, any>,
  url: string,
) {
  insertOrUpdateBlockForSlashMenu(editor, {
    type: "bookmark",
    props: {
      url,
      raw: bookmarkRawFromUrl(url),
    },
  });
}
