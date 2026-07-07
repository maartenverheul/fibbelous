import * as Popover from "@radix-ui/react-popover";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { useState } from "react";
import { EmojiIcon } from "../emoji/EmojiIcon";
import { cn } from "../../lib/utils";

type PageIconPickerProps = {
  icon?: string | null;
  onSelect: (emoji: string) => void;
};

export function PageIconPicker({ icon, onSelect }: PageIconPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        {icon ? (
          <button
            type="button"
            aria-label="Change page icon"
            className={cn(
              "flex size-14 shrink-0 items-center justify-center rounded-md leading-none sm:size-16",
              "hover:bg-stone-100 dark:hover:bg-stone-800",
            )}
          >
            <EmojiIcon icon={icon} size={56} className="sm:hidden" />
            <EmojiIcon icon={icon} size={64} className="hidden sm:inline-flex" />
          </button>
        ) : (
          <button
            type="button"
            className={cn(
              "w-fit rounded-md px-2 py-1 text-sm text-stone-500",
              "hover:bg-stone-100 hover:text-stone-700",
              "dark:hover:bg-stone-800 dark:hover:text-stone-300",
            )}
          >
            Add icon
          </button>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={4}
          className={cn(
            "z-50 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)]",
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
          <Popover.Arrow className="fill-[var(--app-surface)]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
