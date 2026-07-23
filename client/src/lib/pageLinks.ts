const EXTERNAL_LINK_RE = /^(https?:|mailto:|tel:)/i;

/** Strip leading ./ or / from relative hrefs. */
export function normalizePageHref(href: string): string {
  return href.replace(/^\.\//, "").replace(/^\//, "");
}

/**
 * Internal page links are relative paths to `.mdx` files, e.g.
 * `94618e3a-nummers.mdx`, `pages/94618e3a-nummers.mdx`, `./foo.mdx`.
 */
export function isInternalPageLink(href: string): boolean {
  if (!href || EXTERNAL_LINK_RE.test(href)) return false;
  const normalized = normalizePageHref(href);
  if (!normalized.endsWith(".mdx")) return false;
  // Reject scheme-like paths (e.g. javascript:…mdx) and keep it path-shaped.
  if (/^[a-z][a-z0-9+.-]*:/i.test(normalized)) return false;
  return !normalized.includes("://");
}

export function isExternalLink(href: string): boolean {
  return EXTERNAL_LINK_RE.test(href);
}

/**
 * Used by BlockNote at every link gate (HTML import/export, paste, autolink).
 * Invalid hrefs are dropped to plain text on parse and lose their URL on export.
 */
export function isValidEditorLink(href: string): boolean {
  if (!href) return false;
  return isExternalLink(href) || isInternalPageLink(href);
}

export function pageIdFromInternalLink(href: string): string | null {
  if (!isInternalPageLink(href)) return null;

  const normalized = normalizePageHref(href);
  const stem = normalized.slice(
    normalized.lastIndexOf("/") + 1,
    -".mdx".length,
  );
  // `{id}-{slug}` — id is hex (8 from app, longer from imports).
  const match = stem.match(/^([0-9a-f]+)-/i);
  return match?.[1] ?? null;
}

/** Slug portion of `{id}-{slug}.mdx` (null when missing). */
export function slugFromPageLink(href: string): string | null {
  if (!isInternalPageLink(href)) return null;
  const normalized = normalizePageHref(href);
  const stem = normalized.slice(
    normalized.lastIndexOf("/") + 1,
    -".mdx".length,
  );
  const dash = stem.indexOf("-");
  if (dash <= 0 || dash === stem.length - 1) return null;
  return stem.slice(dash + 1);
}

export type PageLinkMeta = {
  id: string;
  name: string;
  icon: string | null;
  link: string;
};

/**
 * Rewrite internal page `<a>` tags to pageLink markers so BlockNote parses them
 * as custom inline content (the default link mark would otherwise win).
 */
export function internalPageLinksToMarkers(
  html: string,
  resolve: (href: string, pageId: string) => PageLinkMeta | undefined,
): string {
  if (!html.includes(".mdx")) return html;

  const doc = new DOMParser().parseFromString(html, "text/html");
  const anchors = [...doc.body.querySelectorAll("a[href]")];
  if (anchors.length === 0) return html;

  for (const anchor of anchors) {
    const href = anchor.getAttribute("href") ?? "";
    if (!isInternalPageLink(href)) continue;

    const pageId = pageIdFromInternalLink(href);
    if (!pageId) continue;

    const normalized = normalizePageHref(href);
    const meta = resolve(normalized, pageId);
    const marker = doc.createElement("span");
    marker.setAttribute("data-inline-content-type", "pageLink");
    marker.setAttribute("data-href", meta?.link ?? normalized);
    marker.setAttribute("data-page-id", pageId);
    marker.setAttribute(
      "data-name",
      meta?.name ?? (anchor.textContent || pageId),
    );
    if (meta?.icon) {
      marker.setAttribute("data-icon", meta.icon);
    }
    anchor.replaceWith(marker);
  }

  return doc.body.innerHTML;
}

/**
 * Turn exported pageLink nodes back into plain `<a href>` for markdown round-trip.
 */
export function pageLinkMarkersToAnchors(html: string): string {
  if (!html.includes("pageLink") && !html.includes("bn-page-link")) {
    return html;
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  const nodes = [
    ...doc.body.querySelectorAll(
      '[data-inline-content-type="pageLink"], a.bn-page-link',
    ),
  ];
  if (nodes.length === 0) return html;

  for (const node of nodes) {
    const href =
      node.getAttribute("data-href")?.trim() ||
      node.getAttribute("href")?.trim() ||
      "";
    if (!href) continue;

    const name =
      node.getAttribute("data-name")?.trim() ||
      node.querySelector(".bn-page-link__name")?.textContent?.trim() ||
      node.textContent?.trim() ||
      href;

    const anchor = doc.createElement("a");
    anchor.setAttribute("href", normalizePageHref(href));
    anchor.textContent = name;
    node.replaceWith(anchor);
  }

  return doc.body.innerHTML;
}
