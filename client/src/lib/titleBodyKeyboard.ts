import { TextSelection } from "prosemirror-state";
import type { PageEditor } from "./pageEditorSchema";

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

/** Move focus to the start of the first block in the page body. */
export function focusEditorDocumentStart(editor: PageEditor) {
  const first = editor.document[0];
  if (first) {
    editor.setTextCursorPosition(first, "start");
  }
  editor.focus();
}
