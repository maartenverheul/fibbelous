import { insertOrUpdateBlockForSlashMenu } from "@blocknote/core/extensions";
import type { BlockNoteEditor } from "@blocknote/core";
import { databaseRawFromId } from "../../database/block";

export function insertDatabaseBlock(
  editor: BlockNoteEditor<any, any, any>,
  databaseId: string,
) {
  insertOrUpdateBlockForSlashMenu(editor, {
    type: "database",
    props: {
      databaseId,
      raw: databaseRawFromId(databaseId),
    },
  });
}
