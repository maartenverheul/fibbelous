import { useEffect, useRef } from "react";
import { PiPlus, PiTable } from "react-icons/pi";
import { cn } from "../../lib/utils";

export type InlineDatabaseChoice = {
  left: number;
  top: number;
};

type InlineDatabaseChoiceMenuProps = {
  choice: InlineDatabaseChoice;
  onNew: () => void;
  onExisting: () => void;
  onDismiss: () => void;
};

export function InlineDatabaseChoiceMenu({
  choice,
  onNew,
  onExisting,
  onDismiss,
}: InlineDatabaseChoiceMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const menu = menuRef.current;
    const firstButton = menu?.querySelector("button");
    firstButton?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onDismiss();
        return;
      }

      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

      const buttons = menu?.querySelectorAll<HTMLButtonElement>("button");
      if (!buttons || buttons.length === 0) return;

      const active = document.activeElement;
      const index = Array.from(buttons).findIndex((btn) => btn === active);
      event.preventDefault();

      if (event.key === "ArrowDown") {
        buttons[(index + 1) % buttons.length]?.focus();
      } else {
        buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (menu?.contains(event.target as Node)) return;
      onDismiss();
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [onDismiss]);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Inline database"
      className={cn(
        "paste-link-choice-menu fixed z-50 flex min-w-44 flex-col",
        "rounded-md border border-(--app-border) bg-(--app-surface) p-1",
        "shadow-md",
      )}
      style={{ left: choice.left, top: choice.top }}
    >
      <button
        type="button"
        role="menuitem"
        className="paste-link-choice-menu__item"
        onClick={onNew}
      >
        <PiPlus size={16} aria-hidden />
        <span className="paste-link-choice-menu__copy">
          <span className="paste-link-choice-menu__title">New database</span>
          <span className="paste-link-choice-menu__sub">
            Create and embed
          </span>
        </span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="paste-link-choice-menu__item"
        onClick={onExisting}
      >
        <PiTable size={16} aria-hidden />
        <span className="paste-link-choice-menu__copy">
          <span className="paste-link-choice-menu__title">
            Existing database
          </span>
          <span className="paste-link-choice-menu__sub">
            Embed from workspace
          </span>
        </span>
      </button>
    </div>
  );
}
