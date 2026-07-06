import { type ReactNode, useState } from "react";
import { cn } from "../../lib/utils";

type CollapsibleSectionProps = {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex w-full items-center gap-1 rounded-md px-1 py-1 text-left text-xs font-medium tracking-wide text-zinc-500 uppercase",
          "hover:text-zinc-700 dark:hover:text-zinc-300",
        )}
      >
        <span className={cn("text-[10px] transition-transform", open && "rotate-90")}>
          ▸
        </span>
        {title}
      </button>
      {open && <div className="mt-0.5 flex flex-col gap-0.5">{children}</div>}
    </section>
  );
}
