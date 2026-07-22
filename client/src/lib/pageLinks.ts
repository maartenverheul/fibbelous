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
