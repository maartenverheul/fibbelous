import { useEffect, useRef, useState } from "react";
import { useTabs, type TabTarget } from "../../context/TabContext";
import { useWorkspacePages } from "../../hooks/useWorkspacePages";
import { cn } from "../../lib/utils";
import { PageActionsMenu } from "./PageActionsMenu";
import {
  childrenDir,
  buildPageSegment,
  isPagePathSegment,
  isPageSegmentActive,
  pageLabel,
  type WorkspacePage,
} from "../../types/page";

type PageTreeItemProps = {
  page: WorkspacePage;
  depth?: number;
  onContextMenu: (
    event: React.MouseEvent,
    segment: string,
    target: TabTarget,
    page: WorkspacePage,
  ) => void;
};

const navButtonClassName = (active: boolean) =>
  cn(
    "rounded-md px-1 py-1 text-left text-sm transition-colors",
    active
      ? "bg-stone-300/70 font-medium text-stone-900 dark:bg-stone-700 dark:text-stone-50"
      : "text-stone-700 hover:bg-stone-200/80 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-50",
  );

const actionButtonClassName = cn(
  "flex h-6 w-6 items-center justify-center rounded text-sm text-stone-500",
  "hover:bg-stone-300/80 hover:text-stone-800",
  "dark:hover:bg-stone-600 dark:hover:text-stone-100",
);

export function PageTreeItem({
  page,
  depth = 0,
  onContextMenu,
}: PageTreeItemProps) {
  const { activeSegment, navigateInTab } = useTabs();
  const { getChildren, ensureChildren, findPageByKey, findPageById } =
    useWorkspacePages();
  const segment = buildPageSegment(page, findPageById);
  const label = pageLabel(page);
  const childParentPath = childrenDir(page);
  const children = getChildren(childParentPath);
  const isActive = isPageSegmentActive(activeSegment, page);

  const createSubpage = () => {
    setOpen(true);
    ensureChildren(childParentPath);
  };
  const menuRef = useRef<HTMLDivElement>(null);

  const isAncestorOfActive =
    isPagePathSegment(activeSegment) &&
    (() => {
      const activePage = findPageByKey(activeSegment);
      return activePage
        ? activePage.path.startsWith(`${childParentPath}/`)
        : false;
    })();

  const [open, setOpen] = useState(isAncestorOfActive);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (page.hasChildren) {
      ensureChildren(childParentPath);
    }
  }, [page.hasChildren, childParentPath, ensureChildren]);

  useEffect(() => {
    if (isAncestorOfActive) {
      setOpen(true);
    }
  }, [isAncestorOfActive]);

  useEffect(() => {
    if (!menuOpen) return;

    const close = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div className={cn(depth > 0 && "pl-3")}>
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("[data-expand-toggle]")) {
              setOpen((value) => !value);
              return;
            }
            if ((event.target as HTMLElement).closest("[data-page-menu]")) {
              setMenuOpen((value) => !value);
              return;
            }
            if ((event.target as HTMLElement).closest("[data-add-child]")) {
              createSubpage();
              return;
            }
            navigateInTab(segment, { label, icon: page.icon, pageId: page.id });
          }}
          onContextMenu={(event) =>
            onContextMenu(event, segment, {
              label,
              icon: page.icon,
              pageId: page.id,
            }, page)
          }
          className={cn(
            navButtonClassName(isActive),
            "group relative flex w-full items-center gap-1 pr-1.5 group-hover:pr-14",
          )}
        >
          <span className="relative flex h-6 w-6 shrink-0 items-center justify-center text-sm">
            {page.hasChildren ? (
              <>
                <span className="group-hover:opacity-0">{page.icon ?? ""}</span>
                <span
                  data-expand-toggle
                  aria-hidden
                  className={cn(
                    "absolute inset-0 flex items-center justify-center rounded text-[10px] text-stone-500 opacity-0 group-hover:opacity-100",
                    "hover:bg-stone-300/80 hover:text-stone-800",
                    "dark:hover:bg-stone-600 dark:hover:text-stone-100",
                  )}
                >
                  <span
                    className={cn("transition-transform", open && "rotate-90")}
                  >
                    ▸
                  </span>
                </span>
              </>
            ) : (
              page.icon ?? ""
            )}
          </span>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <span
            className={cn(
              "absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center",
              "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100",
            )}
          >
            <span
              data-page-menu
              role="button"
              tabIndex={-1}
              aria-label="Page options"
              aria-expanded={menuOpen}
              className={actionButtonClassName}
            >
              ⋯
            </span>
            <span
              data-add-child
              role="button"
              tabIndex={-1}
              aria-label="Add child page"
              className={actionButtonClassName}
            >
              +
            </span>
          </span>
        </button>
        {menuOpen && (
          <div
            className={cn(
              "absolute top-full right-0 z-50 mt-1 min-w-40 rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] py-1 shadow-lg",
            )}
          >
            <PageActionsMenu
              segment={segment}
              target={{ label, icon: page.icon, pageId: page.id }}
              page={page}
              onClose={() => setMenuOpen(false)}
              onCreateSubpage={createSubpage}
            />
          </div>
        )}
      </div>
      {page.hasChildren && open && children && children.length > 0 && (
        <div className="mt-0.5 flex flex-col gap-0.5">
          {children.map((child) => (
            <PageTreeItem
              key={child.id}
              page={child}
              depth={depth + 1}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}
