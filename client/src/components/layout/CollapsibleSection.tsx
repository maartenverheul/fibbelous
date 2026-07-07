import { type ReactNode, useState } from "react";
import { PiCaretRight, PiPlus } from "react-icons/pi";
import { cn } from "../../lib/utils";

type CollapsibleSectionProps = {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  onAdd?: () => void;
  addLabel?: string;
};

export function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
  onAdd,
  addLabel = "Add page",
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="mb-2">
      <div className="group relative flex items-center">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-1 text-left text-xs font-medium tracking-wide text-stone-600 uppercase",
            "hover:text-stone-800 dark:hover:text-stone-300",
            onAdd && "pr-8",
          )}
        >
          <PiCaretRight
            className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-90")}
            aria-hidden
          />
          {title}
        </button>
        {onAdd && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAdd();
            }}
            aria-label={addLabel}
            title={addLabel}
            className={cn(
              "absolute top-1/2 right-1 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-sm text-stone-500",
              "pointer-events-none opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100",
              "hover:bg-stone-300/80 hover:text-stone-800",
              "dark:hover:bg-stone-600 dark:hover:text-stone-100",
            )}
          >
            <PiPlus className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      {open && <div className="mt-0.5 flex flex-col gap-0.5">{children}</div>}
    </section>
  );
}
