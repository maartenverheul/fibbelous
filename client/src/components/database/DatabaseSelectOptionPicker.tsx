import { useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Drawer } from "vaul";
import { PiCheck, PiMagnifyingGlass, PiX } from "react-icons/pi";
import { useSidebar } from "../../context/SidebarContext";
import {
  dbSelectChip,
  dbSelectChipGroup,
  resolveSelectTokens,
} from "../../lib/databaseSelect";
import { cn } from "../../lib/utils";
import type { SelectOption } from "../../types/database";
import { DatabaseSelectChips } from "./DatabaseSelectChips";

type DatabaseSelectOptionPickerProps = {
  value: unknown;
  options: SelectOption[] | undefined;
  multiple: boolean;
  readOnly?: boolean;
  onChange: (next: string | string[] | null) => void;
  ariaLabel: string;
};

function selectedNames(value: unknown): string[] {
  return resolveSelectTokens(value, undefined).map((token) => token.name);
}

function PickerBody({
  options,
  selected,
  onToggle,
  onClear,
}: {
  options: SelectOption[];
  selected: string[];
  onToggle: (name: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.name.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="relative shrink-0">
        <PiMagnifyingGlass
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-app-fg-muted"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search options…"
          className={cn(
            "w-full rounded-md border border-app-border bg-transparent",
            "py-2 pr-3 pl-8 text-sm text-app-fg outline-none",
            "placeholder:text-app-fg-muted focus:border-app-fg-muted",
          )}
        />
      </div>
      {selected.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 self-start text-xs text-app-fg-muted hover:text-app-fg"
        >
          Clear
        </button>
      )}
      <ul className="app-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain">
        {filtered.length === 0 ? (
          <li className="px-2 py-3 text-sm text-app-fg-muted">No options</li>
        ) : (
          filtered.map((option) => {
            const isSelected = selected.some(
              (name) => name.toLowerCase() === option.name.toLowerCase(),
            );
            return (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => onToggle(option.name)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                    "hover:bg-app-border/45",
                    isSelected && "bg-app-border/35",
                  )}
                >
                  <span
                    className={cn(
                      dbSelectChip,
                      `bg-select-${option.color.trim().toLowerCase() || "default"}`,
                    )}
                  >
                    {option.name}
                  </span>
                  <span className="ml-auto shrink-0 text-app-fg-muted">
                    {isSelected ? <PiCheck className="size-4" aria-hidden /> : null}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function TriggerContent({
  value,
  options,
}: {
  value: unknown;
  options: SelectOption[] | undefined;
}) {
  const tokens = resolveSelectTokens(value, options);
  if (tokens.length === 0) {
    return <span className="text-sm text-app-fg-muted">Empty</span>;
  }
  return <DatabaseSelectChips value={value} options={options} />;
}

export function DatabaseSelectOptionPicker({
  value,
  options,
  multiple,
  readOnly,
  onChange,
  ariaLabel,
}: DatabaseSelectOptionPickerProps) {
  const { isMobile } = useSidebar();
  const [open, setOpen] = useState(false);
  const optionList = options ?? [];
  const selected = selectedNames(value);

  const applyToggle = (name: string) => {
    if (multiple) {
      const exists = selected.some(
        (item) => item.toLowerCase() === name.toLowerCase(),
      );
      const next = exists
        ? selected.filter((item) => item.toLowerCase() !== name.toLowerCase())
        : [...selected, name];
      onChange(next.length > 0 ? next : null);
      return;
    }
    const same =
      selected.length === 1 &&
      selected[0]!.toLowerCase() === name.toLowerCase();
    onChange(same ? null : name);
    setOpen(false);
  };

  const applyClear = () => {
    onChange(null);
    if (!multiple) setOpen(false);
  };

  const trigger = (
    <button
      type="button"
      disabled={readOnly}
      aria-label={ariaLabel}
      className={cn(
        "flex min-h-8 w-full min-w-0 items-center rounded-md px-1.5 py-1 text-left",
        "hover:bg-app-border/40",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-app-border",
        readOnly && "pointer-events-none hover:bg-transparent",
      )}
    >
      <span className={cn(dbSelectChipGroup, "min-w-0")}>
        <TriggerContent value={value} options={options} />
      </span>
    </button>
  );

  if (readOnly) {
    return trigger;
  }

  if (isMobile) {
    return (
      <Drawer.Root open={open} onOpenChange={setOpen}>
        <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Drawer.Content
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-xl",
              "border-t border-app-border bg-app-surface outline-none",
            )}
          >
            <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-app-border" />
            <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
              <Drawer.Title className="text-sm font-medium text-app-fg">
                {ariaLabel}
              </Drawer.Title>
              <Drawer.Close
                className="rounded-md p-1 text-app-fg-muted hover:bg-app-border/45 hover:text-app-fg"
                aria-label="Close"
              >
                <PiX className="size-5" />
              </Drawer.Close>
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <PickerBody
                options={optionList}
                selected={selected}
                onToggle={applyToggle}
                onClear={applyClear}
              />
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={6}
          className={cn(
            "z-50 flex max-h-120 w-72 flex-col rounded-lg border border-app-border",
            "bg-app-surface p-2 shadow-lg",
          )}
          onOpenAutoFocus={(event) => {
            const content = event.currentTarget;
            if (!(content instanceof HTMLElement)) return;
            const target = content.querySelector('input[type="search"]');
            if (target instanceof HTMLElement) {
              event.preventDefault();
              target.focus();
            }
          }}
        >
          <PickerBody
            options={optionList}
            selected={selected}
            onToggle={applyToggle}
            onClear={applyClear}
          />
          <Popover.Arrow className="fill-app-surface" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
