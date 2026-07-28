import { TextSelection } from "prosemirror-state";
import type { PageEditor } from "./schema";

/** True when the caret is collapsed at the very start of the document. */
export function isCursorAtDocumentStart(editor: PageEditor): boolean {
  try {
    const { state } = editor.prosemirrorView;
    const { selection } = state;
    if (!selection.empty) return false;
    return selection.from === TextSelection.atStart(state.doc).from;
  } catch {
    return false;
  }
}

/**
 * First block that can hold a text caret. Atom blocks (`content: "none"`, e.g.
 * database) become a NodeSelection with BlockNote's blue outline if targeted.
 */
function firstTextCursorBlock(editor: PageEditor) {
  for (const block of editor.document) {
    const content = editor.schema.blockSchema[block.type]?.content;
    if (content === "inline" || content === "table") {
      return block;
    }
  }
  return undefined;
}

/** Place the text caret at the start of the first editable block (no focus). */
export function placeEditorCursorAtDocumentStart(editor: PageEditor) {
  const target = firstTextCursorBlock(editor);
  if (!target) return;
  try {
    editor.setTextCursorPosition(target, "start");
  } catch {
    // Schema/document may be mid-update.
  }
}

/** Move focus to the start of the first editable block in the page body. */
export function focusEditorDocumentStart(editor: PageEditor) {
  placeEditorCursorAtDocumentStart(editor);
  editor.focus();
}
