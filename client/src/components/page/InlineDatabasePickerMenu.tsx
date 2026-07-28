import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceDatabaseMeta } from "../../lib/database/types";
import { cn } from "../../lib/utils";

export type InlineDatabasePickerAnchor = {
  left: number;
  top: number;
};

type InlineDatabasePickerMenuProps = {
  anchor: InlineDatabasePickerAnchor;
  databases: WorkspaceDatabaseMeta[];
  loading: boolean;
  error: string | null;
  onSelect: (database: WorkspaceDatabaseMeta) => void;
  onDismiss: () => void;
};

function databaseLabel(database: WorkspaceDatabaseMeta): string {
  return (
    database.name?.trim() ||
    database.slug?.trim() ||
    database.id
  );
}

export function InlineDatabasePickerMenu({
  anchor,
  databases,
  loading,
  error,
  onSelect,
  onDismiss,
}: InlineDatabasePickerMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return databases;
    return databases.filter((database) => {
      const label = databaseLabel(database).toLowerCase();
      return (
        label.includes(q) ||
        database.id.toLowerCase().includes(q) ||
        (database.slug?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [databases, query]);

  useEffect(() => {
    inputRef.current?.focus();

    const menu = menuRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onDismiss();
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
      role="listbox"
      aria-label="Choose database"
      className={cn(
        "paste-link-choice-menu fixed z-50 flex w-64 flex-col",
        "rounded-md border border-(--app-border) bg-(--app-surface) p-1",
        "shadow-md",
      )}
      style={{ left: anchor.left, top: anchor.top }}
    >
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search databases…"
        className={cn(
          "mb-1 w-full rounded border border-(--app-border) bg-transparent",
          "px-2 py-1.5 text-sm outline-none",
          "focus:border-(--app-accent)",
        )}
        aria-label="Search databases"
      />
      <div className="max-h-56 overflow-y-auto">
        {loading ? (
          <p className="px-2 py-2 text-sm text-stone-500">Loading…</p>
        ) : error ? (
          <p className="px-2 py-2 text-sm text-red-600">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-2 text-sm text-stone-500">No databases found</p>
        ) : (
          filtered.map((database) => (
            <button
              key={database.id}
              type="button"
              role="option"
              className="paste-link-choice-menu__item w-full"
              onClick={() => onSelect(database)}
            >
              <span className="paste-link-choice-menu__copy">
                <span className="paste-link-choice-menu__title">
                  {databaseLabel(database)}
                </span>
                {database.slug ? (
                  <span className="paste-link-choice-menu__sub">
                    {database.slug}
                  </span>
                ) : null}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
