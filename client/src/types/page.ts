export type WorkspacePage = {
  id: string;
  slug: string | null;
  title: string | null;
  icon: string | null;
  path: string;
  hasChildren: boolean;
};

export type WorkspacePageDetail = WorkspacePage & {
  body: string;
};

export const ROOT_PAGES_DIR = "pages";

export function pageKey(page: WorkspacePage) {
  const slug = page.slug ?? page.id;
  return `${slug}-${page.id}`;
}

export function pageSlug(page: WorkspacePage) {
  return page.slug ?? page.id;
}

export function parsePageKey(
  key: string,
): { pageId: string; pageSlug: string } | null {
  const dash = key.lastIndexOf("-");
  if (dash <= 0) return null;

  return {
    pageSlug: key.slice(0, dash),
    pageId: key.slice(dash + 1),
  };
}

export function parsePageIdFromSegment(segment: string): string | null {
  const leaf = segment.split("/").pop() ?? "";
  return parsePageKey(leaf)?.pageId ?? null;
}

export function buildPageSegment(
  page: WorkspacePage,
  findPageById: (id: string) => WorkspacePage | undefined,
) {
  const crumbs = buildPageBreadcrumbs(page, findPageById);
  const ancestors = crumbs.slice(0, -1).map(pageSlug);
  const leaf = pageKey(page);
  if (ancestors.length === 0) return leaf;
  return [...ancestors, leaf].join("/");
}

export function isPagePathSegment(segment: string) {
  return segment !== "" && segment !== "settings" && parsePageIdFromSegment(segment) !== null;
}

/** @deprecated Use isPagePathSegment */
export function isPageKey(segment: string) {
  return isPagePathSegment(segment);
}

export function isPageSegmentActive(segment: string, page: WorkspacePage) {
  return parsePageIdFromSegment(segment) === page.id;
}

export function pageLabel(page: WorkspacePage) {
  return page.title ?? page.slug ?? page.id;
}

export function humanizeSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function childrenDir(page: WorkspacePage) {
  const lastSlash = page.path.lastIndexOf("/");
  const parent = lastSlash === -1 ? ROOT_PAGES_DIR : page.path.slice(0, lastSlash);
  return `${parent}/${page.id}`;
}

export function parentDirOfPage(page: WorkspacePage) {
  const lastSlash = page.path.lastIndexOf("/");
  return lastSlash === -1 ? ROOT_PAGES_DIR : page.path.slice(0, lastSlash);
}

export function buildPageBreadcrumbs(
  page: WorkspacePage,
  findPageById: (id: string) => WorkspacePage | undefined,
) {
  const crumbs: WorkspacePage[] = [page];
  let dir = parentDirOfPage(page);

  while (dir !== ROOT_PAGES_DIR) {
    const parentId = dir.split("/").pop();
    if (!parentId) break;

    const parent = findPageById(parentId);
    if (!parent) break;

    crumbs.unshift(parent);
    dir = parentDirOfPage(parent);
  }

  return crumbs;
}
