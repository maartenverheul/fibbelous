import { useEffect, useRef, useState } from "react";
import { PiGear, PiTrash } from "react-icons/pi";
import { useTabs, type TabTarget } from "../../context/TabContext";
import { useWorkspacePages } from "../../hooks/useWorkspacePages";
import { cn } from "../../lib/utils";
import { buildPageSegment, pageLabel } from "../../types/page";
import { WorkspaceSelect } from "../workspace/WorkspaceSelect";
import { CollapsibleSection } from "./CollapsibleSection";
import { PageActionsMenu } from "./PageActionsMenu";
import { PageTreeItem } from "./PageTreeItem";
import type { WorkspacePage } from "../../types/page";

type ContextMenuState = {
  x: number;
  y: number;
  segment: string;
  target: TabTarget;
  page?: WorkspacePage;
};

const navButtonClassName = (active: boolean) =>
  cn(
    "rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
    active
      ? "bg-stone-300/70 font-medium text-stone-900 dark:bg-stone-700 dark:text-stone-50"
      : "text-stone-700 hover:bg-stone-200/80 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-50",
  );

export function Sidebar() {
  const { activeSegment, navigateInTab, isTabOpen } = useTabs();
  const {
    rootPages,
    rootError,
    rootLoaded,
    findPageById,
    createPage,
    createRootPage,
    duplicatePage,
    trashPage,
    ensurePageTreeVisible,
  } = useWorkspacePages();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensurePageTreeVisible(activeSegment);
  }, [activeSegment, ensurePageTreeVisible]);

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
    page?: WorkspacePage,
  ) => {
    event.preventDefault();
    if (!page && isTabOpen(segment, target.pageId)) return;
    setContextMenu({ x: event.clientX, y: event.clientY, segment, target, page });
  };

  const openPage = (detail: WorkspacePage) => {
    const newSegment = buildPageSegment(detail, findPageById);
    navigateInTab(newSegment, {
      label: pageLabel(detail),
      icon: detail.icon,
      pageId: detail.id,
    });
  };

  const handleContextCreate = async (page: WorkspacePage) => {
    try {
      const detail = await createPage(page);
      openPage(detail);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateRootPage = async () => {
    try {
      const detail = await createRootPage();
      openPage(detail);
    } catch (error) {
      console.error(error);
    }
  };

  const handleContextDuplicate = async (page: WorkspacePage) => {
    try {
      const detail = await duplicatePage(page.id);
      openPage(detail);
    } catch (error) {
      console.error(error);
    }
  };

  const handleContextTrash = async (page: WorkspacePage) => {
    try {
      await trashPage(page);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to move page to trash");
    }
  };

  return (
    <>
      <aside
        className={cn(
          "flex h-full w-60 shrink-0 flex-col border-r border-[var(--app-border)] bg-[var(--app-panel)]",
        )}
      >
        <WorkspaceSelect />

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-3">
          <CollapsibleSection title="Favorites" defaultOpen>
            <p className="px-2.5 py-1 text-xs text-stone-600 dark:text-stone-400">
              Coming soon
            </p>
          </CollapsibleSection>

          <CollapsibleSection
            title="All pages"
            defaultOpen
            onAdd={() => void handleCreateRootPage()}
            addLabel="Add root page"
          >
            {rootError && !rootPages?.length && (
              <p className="px-2.5 py-1 text-xs text-red-700 dark:text-red-400">
                {rootError}
              </p>
            )}
            {rootLoaded && !rootError && rootPages!.length === 0 && (
              <p className="px-2.5 py-1 text-xs text-stone-600 dark:text-stone-400">
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
          </CollapsibleSection>
        </div>

        <button
          type="button"
          onClick={() => navigateInTab("trash", { label: "Trash" })}
          onContextMenu={(event) =>
            openContextMenu(event, "trash", { label: "Trash" })
          }
          className={cn(
            navButtonClassName(activeSegment === "trash"),
            "mx-3 mt-2 flex shrink-0 items-center gap-2",
          )}
        >
          <PiTrash className="h-4 w-4 shrink-0" aria-hidden />
          Trash
        </button>

        <button
          type="button"
          onClick={() => navigateInTab("settings", { label: "Settings" })}
          onContextMenu={(event) =>
            openContextMenu(event, "settings", { label: "Settings" })
          }
          className={cn(
            navButtonClassName(activeSegment === "settings"),
            "mx-3 mb-3 mt-2 flex shrink-0 items-center gap-2",
          )}
        >
          <PiGear className="h-4 w-4 shrink-0" aria-hidden />
          Settings
        </button>
      </aside>

      {contextMenu && (
        <div
          ref={menuRef}
          className={cn(
            "fixed z-50 min-w-40 rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] py-1 shadow-lg",
          )}
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <PageActionsMenu
            segment={contextMenu.segment}
            target={contextMenu.target}
            page={contextMenu.page}
            onClose={() => setContextMenu(null)}
            onCreateSubpage={
              contextMenu.page
                ? () => void handleContextCreate(contextMenu.page!)
                : undefined
            }
            onDuplicate={
              contextMenu.page
                ? () => void handleContextDuplicate(contextMenu.page!)
                : undefined
            }
            onTrash={
              contextMenu.page
                ? () => void handleContextTrash(contextMenu.page!)
                : undefined
            }
          />
        </div>
      )}
    </>
  );
}
