import { useEffect, useRef } from "react";
import {
  PiBookmarkSimple,
  PiLink,
  PiMapTrifold,
  PiTextT,
} from "react-icons/pi";
import { cn } from "../../lib/utils";

export type PasteLinkChoice = {
  url: string;
  /** Viewport coordinates for the floating menu anchor. */
  left: number;
  top: number;
  offerLinkOptions: boolean;
  offerMaps: boolean;
};

type PasteLinkChoiceMenuProps = {
  choice: PasteLinkChoice;
  onPlainText: () => void;
  onLink: () => void;
  onBookmark: () => void;
  onMaps: () => void;
  onDismiss: () => void;
};

export function PasteLinkChoiceMenu({
  choice,
  onPlainText,
  onLink,
  onBookmark,
  onMaps,
  onDismiss,
}: PasteLinkChoiceMenuProps) {
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
      aria-label="Paste as"
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
        onClick={onPlainText}
      >
        <PiTextT size={16} aria-hidden />
        <span className="paste-link-choice-menu__copy">
          <span className="paste-link-choice-menu__title">Plain text</span>
          <span className="paste-link-choice-menu__sub">As written</span>
        </span>
      </button>
      {choice.offerLinkOptions && (
        <>
          <button
            type="button"
            role="menuitem"
            className="paste-link-choice-menu__item"
            onClick={onLink}
          >
            <PiLink size={16} aria-hidden />
            <span className="paste-link-choice-menu__copy">
              <span className="paste-link-choice-menu__title">Link</span>
              <span className="paste-link-choice-menu__sub">Inline URL</span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="paste-link-choice-menu__item"
            onClick={onBookmark}
          >
            <PiBookmarkSimple size={16} aria-hidden />
            <span className="paste-link-choice-menu__copy">
              <span className="paste-link-choice-menu__title">Bookmark</span>
              <span className="paste-link-choice-menu__sub">
                Full-width card
              </span>
            </span>
          </button>
        </>
      )}
      {choice.offerMaps && (
        <button
          type="button"
          role="menuitem"
          className="paste-link-choice-menu__item"
          onClick={onMaps}
        >
          <PiMapTrifold size={16} aria-hidden />
          <span className="paste-link-choice-menu__copy">
            <span className="paste-link-choice-menu__title">Maps</span>
            <span className="paste-link-choice-menu__sub">
              Embed Google Maps
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
