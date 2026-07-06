import { useEffect, useRef, useState } from "react";
import { useTabs, type TabTarget } from "../../context/TabContext";
import { useWorkspacePages } from "../../hooks/useWorkspacePages";
import { cn } from "../../lib/utils";
import { WorkspaceSelect } from "../workspace/WorkspaceSelect";
import { CollapsibleSection } from "./CollapsibleSection";
import { PageTreeItem } from "./PageTreeItem";
type ContextMenuState = {
  x: number;
  y: number;
  segment: string;
  target: TabTarget;
};

const navButtonClassName = (active: boolean) =>
  cn(
    "rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
    active
      ? "bg-zinc-200 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
  );

export function Sidebar() {
  const { activeSegment, navigateInTab, openTabInNew } = useTabs();
  const { rootPages, rootError, rootLoaded } = useWorkspacePages();  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;

    const close = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setContextMenu(null);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(null);
    };

    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu]);

  const openContextMenu = (
    event: React.MouseEvent,
    segment: string,
    target: TabTarget,
  ) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, segment, target });
  };

  return (
    <>
      <aside
        className={cn(
          "flex h-full w-60 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 p-3",
          "dark:border-zinc-800 dark:bg-zinc-950",
        )}
      >
        <WorkspaceSelect />

        <div className="min-h-0 flex-1 overflow-y-auto">
          <CollapsibleSection title="Favorites" defaultOpen>
            <p className="px-2.5 py-1 text-xs text-zinc-500 dark:text-zinc-400">
              Coming soon
            </p>
          </CollapsibleSection>

          <CollapsibleSection title="All pages" defaultOpen>
            {rootError && (
              <p className="px-2.5 py-1 text-xs text-red-600 dark:text-red-400">
                {rootError}
              </p>
            )}
            {rootLoaded && !rootError && rootPages!.length === 0 && (
              <p className="px-2.5 py-1 text-xs text-zinc-500 dark:text-zinc-400">
                No pages indexed
              </p>
            )}
            {rootPages?.map((page) => (
              <PageTreeItem
                key={page.id}
                page={page}
                onContextMenu={openContextMenu}
              />
            ))}
          </CollapsibleSection>        </div>

        <button
          type="button"
          onClick={() => navigateInTab("settings", { label: "Settings" })}
          onContextMenu={(event) =>
            openContextMenu(event, "settings", { label: "Settings" })
          }
          className={cn(navButtonClassName(activeSegment === "settings"), "mt-2 shrink-0")}
        >
          Settings
        </button>
      </aside>

      {contextMenu && (
        <div
          ref={menuRef}
          className={cn(
            "fixed z-50 min-w-40 rounded-md border border-zinc-200 bg-white py-1 shadow-lg",
            "dark:border-zinc-700 dark:bg-zinc-900",
          )}
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            className={cn(
              "w-full px-3 py-1.5 text-left text-sm text-zinc-700",
              "hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
            )}
            onClick={() => {
              openTabInNew(contextMenu.segment, contextMenu.target);
              setContextMenu(null);
            }}
          >
            Open in new tab
          </button>
        </div>
      )}
    </>
  );
}
