import { Emoji, EmojiStyle } from "emoji-picker-react";
import { cn } from "../../lib/utils";
import { iconToUnified, isIconUrl, nativeEmojiToUnified } from "../../lib/emojiIcon";

type EmojiIconProps = {
  icon?: string | null;
  size?: number;
  className?: string;
};

export function EmojiIcon({ icon, size = 16, className }: EmojiIconProps) {
  if (!icon) return null;

  if (isIconUrl(icon)) {
    return (
      <img
        src={icon}
        alt=""
        aria-hidden
        className={cn("inline-block shrink-0 object-contain", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  const unified = iconToUnified(icon) ?? nativeEmojiToUnified(icon);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center leading-none",
        className,
      )}
    >
      <Emoji unified={unified} size={size} emojiStyle={EmojiStyle.APPLE} />
    </span>
  );
}
