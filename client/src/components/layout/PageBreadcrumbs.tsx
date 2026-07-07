import { useRef } from "react";
import { usePageSave } from "../../context/PageSaveContext";
import { useTabs } from "../../context/TabContext";
import { useWorkspacePages } from "../../hooks/useWorkspacePages";
import { cn } from "../../lib/utils";
import {
  buildPageBreadcrumbs,
  buildPageSegment,
  isPagePathSegment,
  pageLabel,
  parsePageIdFromSegment,
  type WorkspacePage,
} from "../../types/page";
import { PiCheck, PiCircleNotch, PiWarningCircle } from "react-icons/pi";
import { EmojiIcon } from "../emoji/EmojiIcon";

import type { PageSaveStatus } from "../../context/PageSaveContext";

const navClassName = cn(
  "flex min-h-10 min-w-0 shrink-0 items-center justify-between gap-3 border-b border-[var(--app-border)] px-4 py-2 text-sm text-stone-600",
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
  const isSyncing = status === "unsaved" || status === "saving";

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      title={label}
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center",
        status === "saved" && "text-stone-500 dark:text-stone-500",
        isSyncing && "text-stone-700 dark:text-stone-300",
        status === "error" && "text-red-700 dark:text-red-400",
      )}
    >
      {status === "saved" && <PiCheck className="h-4 w-4" aria-hidden />}
      {isSyncing && (
        <PiCircleNotch className="h-4 w-4 animate-spin" aria-hidden />
      )}
      {status === "error" && (
        <PiWarningCircle className="h-4 w-4" aria-hidden />
      )}
    </span>
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
  const { findPageByKey, findPageById, getPageDetailById } = useWorkspacePages();
  const crumbsByPageIdRef = useRef(new Map<string, WorkspacePage[]>());

  if (!isPagePathSegment(activeSegment)) {
    return null;
  }

  const pageId = parsePageIdFromSegment(activeSegment);
  let crumbs = pageId ? crumbsByPageIdRef.current.get(pageId) ?? [] : [];

  if (pageId) {
    const page =
      findPageByKey(activeSegment) ??
      findPageById(pageId) ??
      getPageDetailById(pageId);

    if (page) {
      const built = buildPageBreadcrumbs(page, findPageById);
      if (built.length >= crumbs.length) {
        crumbsByPageIdRef.current.set(pageId, built);
        crumbs = built;
      }
    }
  }

  return (
    <nav aria-label="Breadcrumb" className={navClassName}>
      <div className="flex min-w-0 items-center gap-1">
        <CrumbList
          crumbs={crumbs}
          findPageById={findPageById}
          navigateInTab={navigateInTab}
        />
      </div>
      <PageSaveIndicator status={status} />
    </nav>
  );
}
