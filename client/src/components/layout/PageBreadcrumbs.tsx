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
        "flex min-w-0 shrink-0 items-center gap-1 border-b border-zinc-200 px-4 py-2 text-sm text-zinc-500",
        "dark:border-zinc-800 dark:text-zinc-400",
      )}
    >
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        const label = pageLabel(crumb);
        const segment = buildPageSegment(crumb, findPageById);

        return (
          <span key={crumb.id} className="flex min-w-0 items-center gap-1">
            {index > 0 && <span className="text-zinc-300 dark:text-zinc-600">/</span>}
            {isLast ? (
              <span className="truncate font-medium text-zinc-700 dark:text-zinc-200">
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
                  "truncate rounded px-0.5 hover:text-zinc-900",
                  "dark:hover:text-zinc-100",
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
