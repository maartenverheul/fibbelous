import { useEffect, useRef, useState } from "react";
import { usePageSave } from "../../context/PageSaveContext";
import { useTabs } from "../../context/TabContext";
import { useWorkspacePages } from "../../hooks/useWorkspacePages";
import { cn } from "../../lib/utils";
import {
  buildPageBreadcrumbs,
  buildPageSegment,
  breadcrumbsFromDetail,
  isPagePathSegment,
  pageLabel,
  parsePageIdFromSegment,
  type WorkspacePage,
} from "../../types/page";
import {
  PiCheck,
  PiCircle,
  PiCircleNotch,
  PiDotsThree,
  PiStar,
  PiStarFill,
  PiWarningCircle,
} from "react-icons/pi";
import { EmojiIcon } from "../emoji/EmojiIcon";
import { PageActionsMenu } from "./PageActionsMenu";

import type { PageSaveStatus } from "../../context/PageSaveContext";

const navClassName = cn(
  "flex min-h-10 min-w-0 shrink-0 items-center justify-between gap-3 border-b border-app-border px-4 py-2 text-sm text-stone-600",
  "dark:text-stone-400",
);

const saveStatusLabel: Record<PageSaveStatus, string> = {
  saved: "Saved",
  unsaved: "Unsaved changes",
  saving: "Saving",
  error: "Save failed",
};

function PageSaveIndicator({ status }: { status: PageSaveStatus }) {
  const label = saveStatusLabel[status];
  const isSaving = status === "saving";

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      title={label}
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center",
        status === "saved" && "text-stone-500 dark:text-stone-500",
        status === "unsaved" && "text-stone-700 dark:text-stone-300",
        isSaving && "text-stone-700 dark:text-stone-300",
        status === "error" && "text-red-700 dark:text-red-400",
      )}
    >
      {status === "saved" && <PiCheck className="h-4 w-4" aria-hidden />}
      {status === "unsaved" && <PiCircle className="h-4 w-4" aria-hidden />}
      {isSaving && (
        <PiCircleNotch className="h-4 w-4 animate-spin" aria-hidden />
      )}
      {status === "error" && (
        <PiWarningCircle className="h-4 w-4" aria-hidden />
      )}
    </span>
  );
}

function FavoriteStar({
  favorited,
  onToggle,
}: {
  favorited: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      title={favorited ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={favorited}
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded",
        favorited
          ? "text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
          : "text-stone-500 hover:text-stone-800 dark:text-stone-500 dark:hover:text-stone-200",
      )}
    >
      {favorited ? (
        <PiStarFill className="h-4 w-4" aria-hidden />
      ) : (
        <PiStar className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}

function CrumbList({
  crumbs,
  findPageById,
  navigateInTab,
}: {
  crumbs: WorkspacePage[];
  findPageById: (id: string) => WorkspacePage | undefined;
  navigateInTab: ReturnType<typeof useTabs>["navigateInTab"];
}) {
  return (
    <>
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        const label = pageLabel(crumb);
        const segment = buildPageSegment(crumb, findPageById);

        return (
          <span key={crumb.id} className="flex min-w-0 items-center gap-1">
            {index > 0 && (
              <span className="text-stone-400 dark:text-stone-600">/</span>
            )}
            {isLast ? (
              <span className="flex min-w-0 items-center gap-1 truncate font-medium text-stone-800 dark:text-stone-100">
                {crumb.icon && <EmojiIcon icon={crumb.icon} size={14} />}
                <span className="truncate">{label}</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() =>
                  navigateInTab(segment, {
                    label,
                    icon: crumb.icon,
                    pageId: crumb.id,
                  })
                }
                className={cn(
                  "flex min-w-0 items-center gap-1 truncate rounded px-0.5 hover:text-stone-900",
                  "dark:hover:text-stone-50",
                )}
              >
                {crumb.icon && <EmojiIcon icon={crumb.icon} size={14} />}
                <span className="truncate">{label}</span>
              </button>
            )}
          </span>
        );
      })}
    </>
  );
}

export function PageBreadcrumbs() {
  const { activeSegment, navigateInTab } = useTabs();
  const { status } = usePageSave();
  const {
    findPageByKey,
    findPageById,
    getPageDetailById,
    duplicatePage,
    setPageFavorite,
    trashPage,
  } = useWorkspacePages();
  const crumbsByPageIdRef = useRef(new Map<string, WorkspacePage[]>());
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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

  useEffect(() => {
    setMenuOpen(false);
  }, [activeSegment]);

  if (!isPagePathSegment(activeSegment)) {
    return null;
  }

  const pageId = parsePageIdFromSegment(activeSegment);
  let crumbs = pageId ? crumbsByPageIdRef.current.get(pageId) ?? [] : [];
  let page: WorkspacePage | undefined;

  if (pageId) {
    const detail = getPageDetailById(pageId);
    page = findPageByKey(activeSegment) ?? findPageById(pageId) ?? detail;

    if (page) {
      const built = detail
        ? breadcrumbsFromDetail(detail, findPageById)
        : buildPageBreadcrumbs(page, findPageById);
      if (detail || built.length >= crumbs.length) {
        crumbsByPageIdRef.current.set(pageId, built);
        crumbs = built;
      }
    }
  }

  const favorited = Boolean(page?.favorite);
  const canActOnPage = Boolean(pageId && page);
  const pageTarget = page
    ? {
      label: pageLabel(page),
      icon: page.icon,
      pageId: page.id,
    }
    : null;
  const pageSegment = page ? buildPageSegment(page, findPageById) : null;

  const openPage = (detail: WorkspacePage) => {
    const segment = buildPageSegment(detail, findPageById);
    navigateInTab(segment, {
      label: pageLabel(detail),
      icon: detail.icon,
      pageId: detail.id,
    });
  };

  const handleDuplicate = async () => {
    if (!page) return;
    try {
      const detail = await duplicatePage(page.id);
      openPage(detail);
    } catch (error) {
      console.error(error);
    }
  };

  const handleTrash = async () => {
    if (!page) return;
    try {
      await trashPage(page);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to move page to trash");
    }
  };

  const handleToggleFavorite = async () => {
    if (!pageId) return;
    try {
      await setPageFavorite(pageId, !favorited);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(navClassName, "justify-end md:justify-between")}
    >
      <div className="hidden min-w-0 items-center gap-1 md:flex">
        <CrumbList
          crumbs={crumbs}
          findPageById={findPageById}
          navigateInTab={navigateInTab}
        />
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {canActOnPage && (
          <>
            <FavoriteStar
              favorited={favorited}
              onToggle={() => void handleToggleFavorite()}
            />
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="Page options"
                aria-expanded={menuOpen}
                title="Page options"
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded",
                  "text-stone-700 hover:bg-stone-200/80 hover:text-stone-900",
                  "dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-50",
                )}
              >
                <PiDotsThree className="h-5 w-5" aria-hidden />
              </button>
              {menuOpen && page && pageSegment && pageTarget && (
                <div
                  className={cn(
                    "absolute top-full right-0 z-50 mt-1 min-w-52 rounded-md border border-(--app-border)",
                    "bg-(--app-surface) py-1 shadow-lg",
                  )}
                >
                  <PageActionsMenu
                    segment={pageSegment}
                    target={pageTarget}
                    page={page}
                    onClose={() => setMenuOpen(false)}
                    onDuplicate={() => void handleDuplicate()}
                    onToggleFavorite={() => void handleToggleFavorite()}
                    onTrash={() => void handleTrash()}
                  />
                </div>
              )}
            </div>
          </>
        )}
        <PageSaveIndicator status={status} />
      </div>
    </nav>
  );
}
