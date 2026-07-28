import { useEffect } from "react";
import { PiArrowUp, PiList } from "react-icons/pi";
import { useSidebar } from "../../context/SidebarContext";
import { useTabs } from "../../context/TabContext";
import { useWorkspacePages } from "../../hooks/useWorkspacePages";
import { cn } from "../../lib/utils";
import {
  buildPageSegment,
  pageLabel,
  parsePageIdFromSegment,
  type WorkspacePage,
  type WorkspacePageDetail,
} from "../../lib/page/types";
import { EmojiIcon } from "../emoji/EmojiIcon";

const headerIconButtonClassName = cn(
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-app-fg",
  "hover:bg-stone-200/80 dark:hover:bg-stone-800",
);

function parentFromDetail(detail: WorkspacePageDetail): WorkspacePage | null {
  const ancestors = detail.ancestors;
  if (ancestors && ancestors.length > 0) {
    return ancestors[ancestors.length - 1] ?? null;
  }
  return null;
}

function detailHasParent(detail: WorkspacePageDetail): boolean {
  return (
    parentFromDetail(detail) != null ||
    Boolean(detail.databaseId ?? detail.parentId)
  );
}

export function MobileHeader() {
  const { open } = useSidebar();
  const { tabs, activeTabId, activeSegment, navigateInTab } = useTabs();
  const { findPageById, getPageDetailById, fetchPageDetail } =
    useWorkspacePages();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const pageId =
    activeTab?.pageId ??
    parsePageIdFromSegment(activeTab?.segment ?? activeSegment);
  const detail = pageId ? getPageDetailById(pageId) : undefined;
  const parentPage = detail ? parentFromDetail(detail) : null;
  const showParentButton = detail ? detailHasParent(detail) : false;

  // Ensure we have get_page (ancestors) so the up button can appear on web.
  useEffect(() => {
    if (!pageId || detail) return;
    void fetchPageDetail(pageId);
  }, [pageId, detail, fetchPageDetail]);

  const goToParent = async () => {
    if (!pageId) return;

    try {
      const pageDetail = detail ?? (await fetchPageDetail(pageId));
      if (!pageDetail) return;

      let parent = parentFromDetail(pageDetail);
      if (!parent) {
        const parentId = pageDetail.databaseId ?? pageDetail.parentId ?? null;
        if (!parentId) return;
        parent =
          findPageById(parentId) ??
          getPageDetailById(parentId) ??
          (await fetchPageDetail(parentId));
      }
      if (!parent) return;

      navigateInTab(buildPageSegment(parent, findPageById), {
        label: pageLabel(parent),
        icon: parent.icon,
        pageId: parent.id,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const parentLabel = parentPage ? pageLabel(parentPage) : "Parent page";

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
        className={headerIconButtonClassName}
      >
        <PiList size={20} className="shrink-0" aria-hidden />
      </button>
      {showParentButton ? (
        <button
          type="button"
          onClick={() => void goToParent()}
          aria-label={`Go to ${parentLabel}`}
          title={parentLabel}
          className={headerIconButtonClassName}
        >
          <PiArrowUp size={20} className="shrink-0" aria-hidden />
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
