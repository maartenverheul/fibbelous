import { usePageSave } from "../../context/PageSaveContext";
import { useTabs } from "../../context/TabContext";
import { useWorkspacePages } from "../../hooks/useWorkspacePages";
import { cn } from "../../lib/utils";
import {
  buildPageBreadcrumbs,
  buildPageSegment,
  isPagePathSegment,
  pageLabel,
} from "../../types/page";

import type { PageSaveStatus } from "../../context/PageSaveContext";

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
      {status === "saved" && (
        <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
          <path
            d="M3 8.5 6.5 12 13 4"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {isSyncing && (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className="h-4 w-4 animate-spin"
          aria-hidden
        >
          <circle
            cx="8"
            cy="8"
            r="5.25"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeOpacity="0.25"
          />
          <path
            d="M8 2.75a5.25 5.25 0 0 1 5.25 5.25"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      )}
      {status === "error" && (
        <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
          <circle cx="8" cy="8" r="5.25" stroke="currentColor" strokeWidth="1.75" />
          <path
            d="M8 5.25v3.5M8 10.75h.01"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      )}
    </span>
  );
}

export function PageBreadcrumbs() {
  const { activeSegment, navigateInTab } = useTabs();
  const { status } = usePageSave();
  const { findPageByKey, findPageById } = useWorkspacePages();

  if (!isPagePathSegment(activeSegment)) {
    return null;
  }

  const page = findPageByKey(activeSegment);
  if (!page) {
    return null;
  }

  const crumbs = buildPageBreadcrumbs(page, findPageById);

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex min-w-0 shrink-0 items-center justify-between gap-3 border-b border-[var(--app-border)] px-4 py-2 text-sm text-stone-600",
        "dark:text-stone-400",
      )}
    >
      <div className="flex min-w-0 items-center gap-1">
        {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        const label = pageLabel(crumb);
        const segment = buildPageSegment(crumb, findPageById);

        return (
          <span key={crumb.id} className="flex min-w-0 items-center gap-1">
            {index > 0 && <span className="text-stone-400 dark:text-stone-600">/</span>}
            {isLast ? (
              <span className="flex min-w-0 items-center gap-1 truncate font-medium text-stone-800 dark:text-stone-100">
                {crumb.icon && (
                  <span className="shrink-0 text-sm leading-none" aria-hidden>
                    {crumb.icon}
                  </span>
                )}
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
                {crumb.icon && (
                  <span className="shrink-0 text-sm leading-none" aria-hidden>
                    {crumb.icon}
                  </span>
                )}
                <span className="truncate">{label}</span>
              </button>
            )}
          </span>
        );
      })}
      </div>
      <PageSaveIndicator status={status} />
    </nav>
  );
}
