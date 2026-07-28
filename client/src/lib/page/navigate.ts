import type { WorkspacePage } from "./types";
import { buildPageSegment, pageLabel } from "./types";

type PageNavigator = (
  segment: string,
  target: { label: string; icon?: string | null; pageId: string },
) => void;

type PageFinder = (id: string) => WorkspacePage | undefined;

let navigator: PageNavigator | null = null;
let findPageById: PageFinder | null = null;
let pendingTitleFocusPageId: string | null = null;

/** Wired from TabProvider so BlockNote DOM renders can open pages. */
export function registerPageNavigator(
  nextNavigator: PageNavigator | null,
  nextFinder: PageFinder | null = null,
) {
  navigator = nextNavigator;
  findPageById = nextFinder;
}

/** Ask PageView to focus+select the title when this page next opens. */
export function requestPageTitleFocus(pageId: string) {
  pendingTitleFocusPageId = pageId;
}

/** Whether a title-focus request is pending for this page (does not clear). */
export function shouldFocusPageTitle(pageId: string): boolean {
  return pendingTitleFocusPageId === pageId;
}

/** Returns true once for the matching pageId, then clears the request. */
export function consumePageTitleFocus(pageId: string): boolean {
  if (pendingTitleFocusPageId !== pageId) return false;
  pendingTitleFocusPageId = null;
  return true;
}

/** Open a workspace page in the active tab. */
export function openWorkspacePage(
  page: WorkspacePage,
  options?: { focusTitle?: boolean },
) {
  if (!navigator) {
    throw new Error("No page navigator");
  }
  if (options?.focusTitle) {
    requestPageTitleFocus(page.id);
  }
  const finder = findPageById ?? (() => undefined);
  navigator(buildPageSegment(page, finder), {
    label: pageLabel(page),
    icon: page.icon,
    pageId: page.id,
  });
}

/** Lookup a cached workspace page (e.g. database host) from BlockNote DOM code. */
export function findWorkspacePageById(id: string): WorkspacePage | undefined {
  return findPageById?.(id);
}
