import * as Popover from "@radix-ui/react-popover";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { useState, type ReactNode } from "react";
import { PiFolder } from "react-icons/pi";
import { cn } from "../../lib/utils";
import { EmojiIcon } from "./EmojiIcon";

type EmojiIconPickerProps = {
  icon?: string | null;
  onSelect: (emoji: string) => void;
  className?: string;
  /** Shown when `icon` is empty. Defaults to a folder glyph. */
  emptyIcon?: ReactNode;
};

export function EmojiIconPicker({
  icon,
  onSelect,
  className,
  emptyIcon,
}: EmojiIconPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root modal open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={icon ? "Change icon" : "Add icon"}
          className={cn(
            "flex h-[34px] w-full items-center justify-center rounded-md border border-app-border bg-app-surface",
            "hover:bg-stone-100 dark:hover:bg-stone-800",
            className,
          )}
        >
          {icon ? (
            <EmojiIcon icon={icon} size={20} />
          ) : (
            (emptyIcon ?? (
              <PiFolder className="h-5 w-5 text-stone-500" aria-hidden />
            ))
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={4}
          className={cn(
            "z-[60] rounded-lg border border-app-border bg-app-surface",
            "shadow-lg",
          )}
        >
          <EmojiPicker
            onEmojiClick={(data) => {
              onSelect(data.emoji);
              setOpen(false);
            }}
            theme={Theme.AUTO}
            width={320}
            height={400}
            searchPlaceholder="Search emoji…"
          />
          <Popover.Arrow className="fill-app-surface" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
