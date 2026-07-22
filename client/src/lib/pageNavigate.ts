import type { WorkspacePage } from "../types/page";
import { buildPageSegment, pageLabel } from "../types/page";

type PageNavigator = (
  segment: string,
  target: { label: string; icon?: string | null; pageId: string },
) => void;

type PageFinder = (id: string) => WorkspacePage | undefined;

let navigator: PageNavigator | null = null;
let findPageById: PageFinder | null = null;

/** Wired from TabProvider so BlockNote DOM renders can open pages. */
export function registerPageNavigator(
  nextNavigator: PageNavigator | null,
  nextFinder: PageFinder | null = null,
) {
  navigator = nextNavigator;
  findPageById = nextFinder;
}

/** Open a workspace page in the active tab. */
export function openWorkspacePage(page: WorkspacePage) {
  if (!navigator) {
    throw new Error("No page navigator");
  }
  const finder = findPageById ?? (() => undefined);
  navigator(buildPageSegment(page, finder), {
    label: pageLabel(page),
    icon: page.icon,
    pageId: page.id,
  });
}
