import { normalizeMapsInput } from "./mdxPlaceholders";
import type { PageEditor } from "./schema";

/** Single http(s) URL with no surrounding text. */
export function isBareHttpUrl(text: string): boolean {
  const trimmed = text.trim();
  if (!/^https?:\/\/\S+$/i.test(trimmed)) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isEmptyInlineBlock(editor: PageEditor): boolean {
  const { block } = editor.getTextCursorPosition();
  if (!Array.isArray(block.content)) return false;
  return block.content.length === 0;
}

export type PasteLinkChoiceOptions = {
  /** Offer inline Link + Bookmark (bare http(s) URLs). */
  offerLinkOptions: boolean;
  /** Offer Maps embed (Google Maps URL or coordinates). */
  offerMaps: boolean;
};

export function getPasteLinkChoiceOptions(
  text: string,
): PasteLinkChoiceOptions | null {
  const offerLinkOptions = isBareHttpUrl(text);
  const offerMaps = normalizeMapsInput(text) !== null;
  if (!offerLinkOptions && !offerMaps) return null;
  return { offerLinkOptions, offerMaps };
}

/**
 * Whether pasting `text` should open the paste choice menu instead of the
 * default paste path.
 */
export function shouldOfferPasteLinkChoice(
  editor: PageEditor,
  text: string,
): boolean {
  if (!getPasteLinkChoiceOptions(text)) return false;
  // Pasting over selected text should become a normal link / plain text.
  if (editor.getSelectedText()) return false;
  // Mid-paragraph paste stays inline; only empty blocks get the menu.
  return isEmptyInlineBlock(editor);
}

export function insertPastedInlineLink(editor: PageEditor, url: string) {
  editor.createLink(url, url);
}

export function insertPastedPlainText(editor: PageEditor, text: string) {
  editor.pasteText(text);
}
