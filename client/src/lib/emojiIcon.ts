import { emojiByUnified } from "emoji-picker-react";

export function isIconUrl(icon: string) {
  return /^https?:\/\//i.test(icon);
}

export function nativeEmojiToUnified(emoji: string) {
  const codepoints: number[] = [];

  for (let index = 0; index < emoji.length; ) {
    const codePoint = emoji.codePointAt(index)!;
    codepoints.push(codePoint);
    index += codePoint > 0xffff ? 2 : 1;
  }

  return codepoints.map((code) => code.toString(16)).join("-");
}

export function iconToUnified(icon: string) {
  if (isIconUrl(icon)) return null;

  const unified = nativeEmojiToUnified(icon);
  return emojiByUnified(unified) ? unified : null;
}
