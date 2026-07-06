import { useTabs } from "../../context/TabContext";
import { useWorkspacePages } from "../../hooks/useWorkspacePages";
import { cn } from "../../lib/utils";
import {
  buildPageBreadcrumbs,
  buildPageSegment,
  isPagePathSegment,
  pageLabel,
} from "../../types/page";

export function PageBreadcrumbs() {
  const { activeSegment, navigateInTab } = useTabs();
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
        "flex min-w-0 shrink-0 items-center gap-1 border-b border-[var(--app-border)] px-4 py-2 text-sm text-stone-600",
        "dark:text-stone-400",
      )}
    >
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        const label = pageLabel(crumb);
        const segment = buildPageSegment(crumb, findPageById);

        return (
          <span key={crumb.id} className="flex min-w-0 items-center gap-1">
            {index > 0 && <span className="text-stone-400 dark:text-stone-600">/</span>}
            {isLast ? (
              <span className="truncate font-medium text-stone-800 dark:text-stone-100">
                {label}
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
                  "truncate rounded px-0.5 hover:text-stone-900",
                  "dark:hover:text-stone-50",
                )}
              >
                {label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
