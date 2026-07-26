import { useEffect, useRef, useState } from "react";
import { PiFileText, PiGear, PiMagnifyingGlass, PiTrash, PiX } from "react-icons/pi";
import { useSidebar } from "../../context/SidebarContext";
import { useTabs, type TabTarget } from "../../context/TabContext";
import { useWorkspacePages } from "../../hooks/useWorkspacePages";
import { requestPageTitleFocus } from "../../lib/page/navigate";
import { cn } from "../../lib/utils";
import {
  buildPageSegment,
  isPageSegmentActive,
  pageLabel,
} from "../../lib/page/types";
import { WorkspaceSelect } from "../workspace/WorkspaceSelect";
import { CollapsibleSection } from "./CollapsibleSection";
import { PageActionsMenu } from "./PageActionsMenu";
import { PageTreeItem } from "./PageTreeItem";
import { EmojiIcon } from "../emoji/EmojiIcon";
import type { WorkspacePage } from "../../lib/page/types";

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
  const { isMobile, isOpen, close } = useSidebar();
  const { activeSegment, navigateInTab, isTabOpen } = useTabs();
  const {
    rootPages,
    favoritePages,
    rootError,
    rootLoaded,
    findPageById,
    createRootPage,
    duplicatePage,
    setPageFavorite,
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

  const navigateFromSidebar = (
    segment: string,
    target: TabTarget,
    active: boolean,
  ) => {
    if (isMobile && active) {
      close();
      return;
    }
    navigateInTab(segment, target);
  };

  const handleCreateRootPage = async () => {
    try {
      const detail = await createRootPage();
      requestPageTitleFocus(detail.id);
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

  const handleContextToggleFavorite = async (page: WorkspacePage) => {
    try {
      await setPageFavorite(page.id, !page.favorite);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <>
      <aside
        aria-hidden={isMobile && !isOpen}
        className={cn(
          "flex h-full shrink-0 flex-col border-r border-app-border bg-app-panel",
          isMobile ? "w-full" : "w-60",
          isMobile &&
            "fixed inset-0 z-40 transition-transform duration-200 ease-out",
          isMobile && !isOpen && "-translate-x-full pointer-events-none",
          isMobile && isOpen && "translate-x-0",
        )}
      >
        {isMobile && (
          <div className="flex shrink-0 justify-end border-b border-app-border px-2 py-1">
            <button
              type="button"
              onClick={close}
              aria-label="Close sidebar"
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-md text-stone-700",
                "hover:bg-stone-200/80 dark:text-stone-300 dark:hover:bg-stone-800",
              )}
            >
              <PiX className="h-5 w-5" aria-hidden />
            </button>
          </div>
        )}
        <WorkspaceSelect />

        <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-3 pt-3">
          <CollapsibleSection title="Favorites" defaultOpen>
            {favoritePages.length === 0 ? (
              <p className="px-2.5 py-1 text-xs text-stone-600 dark:text-stone-400">
                No favorites yet
              </p>
            ) : (
              favoritePages.map((page) => {
                const segment = buildPageSegment(page, findPageById);
                const label = pageLabel(page);
                const active = isPageSegmentActive(activeSegment, page);
                return (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() =>
                      navigateFromSidebar(
                        segment,
                        {
                          label,
                          icon: page.icon,
                          pageId: page.id,
                        },
                        active,
                      )
                    }
                    onContextMenu={(event) =>
                      openContextMenu(
                        event,
                        segment,
                        { label, icon: page.icon, pageId: page.id },
                        page,
                      )
                    }
                    className={cn(
                      navButtonClassName(active),
                      "flex w-full items-center gap-2",
                    )}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                      {page.icon ? (
                        <EmojiIcon icon={page.icon} size={15} />
                      ) : (
                        <PiFileText
                          className="h-4 w-4 text-stone-400 dark:text-stone-500"
                          aria-hidden
                        />
                      )}
                    </span>
                    <span className="min-w-0 truncate">{label}</span>
                  </button>
                );
              })
            )}
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
          onClick={() =>
            navigateFromSidebar(
              "search",
              { label: "Search" },
              activeSegment === "search",
            )
          }
          onContextMenu={(event) =>
            openContextMenu(event, "search", { label: "Search" })
          }
          className={cn(
            navButtonClassName(activeSegment === "search"),
            "mx-3 mt-2 flex shrink-0 items-center gap-2",
          )}
        >
          <PiMagnifyingGlass className="h-4 w-4 shrink-0" aria-hidden />
          Search
        </button>

        <button
          type="button"
          onClick={() =>
            navigateFromSidebar(
              "trash",
              { label: "Trash" },
              activeSegment === "trash",
            )
          }
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
          onClick={() =>
            navigateFromSidebar(
              "settings",
              { label: "Settings" },
              activeSegment === "settings",
            )
          }
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
            "fixed z-50 min-w-52 rounded-md border border-app-border bg-app-surface py-1 shadow-lg",
          )}
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <PageActionsMenu
            segment={contextMenu.segment}
            target={contextMenu.target}
            page={contextMenu.page}
            onClose={() => setContextMenu(null)}
            onDuplicate={
              contextMenu.page
                ? () => void handleContextDuplicate(contextMenu.page!)
                : undefined
            }
            onToggleFavorite={
              contextMenu.page
                ? () => void handleContextToggleFavorite(contextMenu.page!)
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
