export type WorkspacePage = {
  id: string;
  /** Null when the page is at the workspace root. */
  parentId?: string | null;
  slug: string | null;
  title: string | null;
  icon: string | null;
  path: string;
  hasChildren: boolean;
  /** Present when this page is a database row; id of the host database page. */
  databaseId?: string | null;
  /** Whether the page is in the workspace favorites list. */
  favorite?: boolean;
  /**
   * Nested descendants when `list_pages` is called with depth > 1.
   * Not kept in the local page cache; used only to hydrate child lists.
   */
  children?: WorkspacePage[];
};

/** Default depth for sidebar `list_pages` (self + children of children). */
export const DEFAULT_LIST_PAGES_DEPTH = 2;

/** Sentinel key for root-level children in the client tree cache. */
export const ROOT_PARENT_ID = null;

export type SearchPageHit = WorkspacePage & {
  matchIn: "title" | "slug" | "body";
  snippet: string | null;
};

/** Page linked from a body via an internal `.mdx` href (from `get_page`). */
export type ReferencedPage = {
  id: string;
  /** Parent id when supplied by the page-detail response. */
  parentId?: string | null;
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
  /** Ordered root → immediate parent (from `get_page`). */
  ancestors?: WorkspacePage[];
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
    parentId: null,
    slug: page.slug,
    title: page.title,
    icon: page.icon,
    path: page.originalPath,
    hasChildren: page.hasChildren,
  });
}

/** @deprecated Prefer parentId-based tree keys; kept for path display only. */
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

/** Cache / RPC key for a parent’s children list (`null` = workspace root). */
export function childrenParentKey(page: WorkspacePage): string | null {
  return page.id;
}

/** Parent id whose children list contains this page. */
export function parentKeyOfPage(page: WorkspacePage): string | null {
  return page.parentId ?? null;
}

/** Stable map key for `childrenByParent` (`"root"` when parent is null). */
export function treeCacheKey(parentId: string | null): string {
  return parentId ?? "root";
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
  let parentId = page.parentId ?? null;

  while (parentId) {
    const parent = findPageById(parentId);
    if (!parent) break;

    crumbs.unshift(parent);
    parentId = parent.parentId ?? null;
  }

  return crumbs;
}

/**
 * Prefer ancestors from `get_page`; fall back to walking `parentId` in the
 * local cache.
 */
export function breadcrumbsFromDetail(
  detail: WorkspacePageDetail,
  findPageById: (id: string) => WorkspacePage | undefined,
): WorkspacePage[] {
  if (detail.ancestors && detail.ancestors.length > 0) {
    return [...detail.ancestors, detail];
  }
  return buildPageBreadcrumbs(detail, findPageById);
}
