export type WorkspacePage = {
  id: string;
  slug: string | null;
  title: string | null;
  icon: string | null;
  path: string;
  hasChildren: boolean;
  /** Present when this page is a database row; id of the host database page. */
  databaseId?: string | null;
  /**
   * Nested descendants when `list_pages` is called with depth > 1.
   * Not kept in the local page cache; used only to hydrate child dirs.
   */
  children?: WorkspacePage[];
};

/** Default depth for sidebar `list_pages` (self + children of children). */
export const DEFAULT_LIST_PAGES_DEPTH = 2;

export type SearchPageHit = WorkspacePage & {
  matchIn: "title" | "slug" | "body";
  snippet: string | null;
};

/** Page linked from a body via an internal `.mdx` href (from `get_page`). */
export type ReferencedPage = {
  id: string;
  name: string;
  icon: string | null;
  /** Workspace-relative path used as the full internal link. */
  link: string;
};

export type WorkspacePageDetail = WorkspacePage & {
  body: string;
  /** First 10 hex chars of SHA-256(body UTF-8). */
  bodyHash: string;
  /**
   * Pages referenced by internal `.mdx` links in `body`.
   * Always included with page content from `get_page` / page mutations.
   */
  referencedPages: ReferencedPage[];
};

/** Compact op: `[0, index, length]` delete or `[1, index, text]` insert. */
export type BodyPatchOp =
  | [0, index: number, length: number]
  | [1, index: number, text: string];

export type BodyPatch = {
  baseHash: string;
  resultHash: string;
  ops: BodyPatchOp[];
};

export type TrashedPage = {
  id: string;
  slug: string | null;
  title: string | null;
  icon: string | null;
  originalPath: string;
  trashedAt: string;
  hasChildren: boolean;
};

export type TrashedPageDetail = TrashedPage & {
  body: string;
};

export function buildTrashedPageSegment(page: TrashedPage) {
  return pageKey({
    id: page.id,
    slug: page.slug,
    title: page.title,
    icon: page.icon,
    path: page.originalPath,
    hasChildren: page.hasChildren,
  });
}

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
  return (
    segment !== "" &&
    segment !== "settings" &&
    segment !== "search" &&
    parsePageIdFromSegment(segment) !== null
  );
}

/** @deprecated Use isPagePathSegment */
export function isPageKey(segment: string) {
  return isPagePathSegment(segment);
}

export function isPageSegmentActive(segment: string, page: WorkspacePage) {
  return parsePageIdFromSegment(segment) === page.id;
}

export function pageLabel(page: {
  id: string;
  title: string | null;
  slug: string | null;
}) {
  return page.title ?? page.slug ?? page.id;
}

export function humanizeSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function slugifyPageTitle(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "page";
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
): WorkspacePage[] {
  if (page.databaseId) {
    const host = findPageById(page.databaseId);
    if (host) {
      return [...buildPageBreadcrumbs(host, findPageById), page];
    }
    return [page];
  }

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
