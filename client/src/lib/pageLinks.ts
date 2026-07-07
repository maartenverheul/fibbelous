import { ROOT_PAGES_DIR } from "../types/page";

const EXTERNAL_LINK_RE = /^(https?:|mailto:|tel:)/i;

export function isInternalPageLink(href: string): boolean {
  return href.startsWith(`${ROOT_PAGES_DIR}/`) && href.endsWith(".mdx");
}

export function isExternalLink(href: string): boolean {
  return EXTERNAL_LINK_RE.test(href);
}

export function isValidEditorLink(href: string): boolean {
  return isExternalLink(href) || isInternalPageLink(href);
}

export function pageIdFromInternalLink(href: string): string | null {
  if (!isInternalPageLink(href)) return null;

  const stem = href.slice(href.lastIndexOf("/") + 1, -".mdx".length);
  const match = stem.match(/^([0-9a-f]{8})-/i);
  return match?.[1] ?? null;
}
