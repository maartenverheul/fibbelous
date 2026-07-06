import { useEffect, useRef, useState } from "react";
import { useTabs, type TabTarget } from "../../context/TabContext";
import { useWorkspacePages } from "../../hooks/useWorkspacePages";
import { cn } from "../../lib/utils";
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
  ) => void;
};

const navButtonClassName = (active: boolean) =>
  cn(
    "rounded-md px-1 py-1 text-left text-sm transition-colors",
    active
      ? "bg-zinc-200 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
  );

const actionButtonClassName = cn(
  "flex h-6 w-6 items-center justify-center rounded text-sm text-zinc-400",
  "hover:bg-zinc-300 hover:text-zinc-800",
  "dark:hover:bg-zinc-600 dark:hover:text-zinc-100",
);

export function PageTreeItem({
  page,
  depth = 0,
  onContextMenu,
}: PageTreeItemProps) {
  const { activeSegment, navigateInTab, openTabInNew } = useTabs();
  const { getChildren, ensureChildren, findPageByKey, findPageById } =
    useWorkspacePages();
  const segment = buildPageSegment(page, findPageById);
  const label = pageLabel(page);
  const childParentPath = childrenDir(page);
  const children = getChildren(childParentPath);
  const isActive = isPageSegmentActive(activeSegment, page);
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
              setOpen(true);
              ensureChildren(childParentPath);
              return;
            }
            navigateInTab(segment, { label, icon: page.icon, pageId: page.id });
          }}
          onContextMenu={(event) =>
            onContextMenu(event, segment, {
              label,
              icon: page.icon,
              pageId: page.id,
            })
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
                    "absolute inset-0 flex items-center justify-center rounded text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100",
                    "hover:bg-zinc-300 hover:text-zinc-800",
                    "dark:hover:bg-zinc-600 dark:hover:text-zinc-100",
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
              "absolute top-full right-0 z-50 mt-1 min-w-36 rounded-md border border-zinc-200 bg-white py-1 shadow-lg",
              "dark:border-zinc-700 dark:bg-zinc-900",
            )}
          >
            <button
              type="button"
              className={cn(
                "w-full px-3 py-1.5 text-left text-sm text-zinc-700",
                "hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
              )}
              onClick={() => {
                openTabInNew(segment, { label, icon: page.icon, pageId: page.id });
                setMenuOpen(false);
              }}
            >
              Open in new tab
            </button>
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
