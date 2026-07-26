import { PiArrowUp, PiList } from "react-icons/pi";
import { useSidebar } from "../../context/SidebarContext";
import { useTabs } from "../../context/TabContext";
import { useWorkspacePages } from "../../hooks/useWorkspacePages";
import { cn } from "../../lib/utils";
import {
  buildPageSegment,
  pageLabel,
  type WorkspacePage,
  type WorkspacePageDetail,
} from "../../lib/page/types";
import { EmojiIcon } from "../emoji/EmojiIcon";

function resolveParentPage(
  pageId: string | null | undefined,
  findPageById: (id: string) => WorkspacePage | undefined,
  getPageDetailById: (id: string) => WorkspacePageDetail | undefined,
): WorkspacePage | null {
  if (!pageId) return null;

  const detail = getPageDetailById(pageId);
  const ancestors = detail?.ancestors;
  if (ancestors && ancestors.length > 0) {
    return ancestors[ancestors.length - 1] ?? null;
  }

  const page = findPageById(pageId) ?? detail;
  if (!page) return null;

  const parentId = page.databaseId ?? page.parentId ?? null;
  if (!parentId) return null;

  return findPageById(parentId) ?? getPageDetailById(parentId) ?? null;
}

export function MobileHeader() {
  const { open } = useSidebar();
  const { tabs, activeTabId, navigateInTab } = useTabs();
  const { findPageById, getPageDetailById } = useWorkspacePages();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const parentPage = resolveParentPage(
    activeTab?.pageId,
    findPageById,
    getPageDetailById,
  );

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-11 shrink-0 items-center gap-1 border-b border-app-border bg-app-panel px-2 md:hidden",
      )}
    >
      <button
        type="button"
        onClick={open}
        aria-label="Open sidebar"
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-stone-700",
          "hover:bg-stone-200/80 dark:text-stone-300 dark:hover:bg-stone-800",
        )}
      >
        <PiList className="h-5 w-5" aria-hidden />
      </button>
      {parentPage ? (
        <button
          type="button"
          onClick={() =>
            navigateInTab(buildPageSegment(parentPage, findPageById), {
              label: pageLabel(parentPage),
              icon: parentPage.icon,
              pageId: parentPage.id,
            })
          }
          aria-label={`Go to ${pageLabel(parentPage)}`}
          title={pageLabel(parentPage)}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-stone-700",
            "hover:bg-stone-200/80 dark:text-stone-300 dark:hover:bg-stone-800",
          )}
        >
          <PiArrowUp className="h-5 w-5" aria-hidden />
        </button>
      ) : null}
      {activeTab ? (
        <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm font-medium text-stone-900 dark:text-stone-50">
          {activeTab.icon ? (
            <EmojiIcon icon={activeTab.icon} size={16} />
          ) : null}
          <span className="truncate">{activeTab.label}</span>
        </span>
      ) : null}
    </header>
  );
}
