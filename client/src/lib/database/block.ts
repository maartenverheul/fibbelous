import {
  MDX_PLACEHOLDER_TAG_RE,
  idAttrFromMdxRaw,
  mdxRawWithAttrs,
} from "../editor/mdxPlaceholders";
import type { DatabaseView } from "./types";

export function databaseRawFromId(
  id: string,
  existingRaw?: string,
): string {
  return mdxRawWithAttrs("database", { id }, existingRaw);
}

/**
 * True when the page body is a single `<Database />` tag (optional blank lines).
 * Those pages render outside BlockNote as a full-page table.
 */
export function isDatabaseOnlyBody(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) return false;

  let databaseCount = 0;
  let otherTagCount = 0;
  MDX_PLACEHOLDER_TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MDX_PLACEHOLDER_TAG_RE.exec(trimmed)) !== null) {
    const tag = match[1];
    if (tag.toLowerCase() === "database") {
      databaseCount += 1;
    } else {
      otherTagCount += 1;
    }
  }

  if (databaseCount !== 1 || otherTagCount > 0) return false;

  const withoutTags = trimmed.replace(MDX_PLACEHOLDER_TAG_RE, "").trim();
  return withoutTags.length === 0;
}

/** `id` from the sole `<Database id="…" />` in a database-only body. */
export function databaseIdFromBody(body: string): string | null {
  if (!isDatabaseOnlyBody(body)) return null;

  MDX_PLACEHOLDER_TAG_RE.lastIndex = 0;
  const match = MDX_PLACEHOLDER_TAG_RE.exec(body.trim());
  if (!match || match[1].toLowerCase() !== "database") return null;

  return idAttrFromMdxRaw(match[0].trim()) || null;
}

export function resolveDatabaseViewId(
  views: DatabaseView[],
  preferredId?: string | null,
): string {
  if (preferredId && views.some((view) => view.id === preferredId)) {
    return preferredId;
  }
  return views[0]?.id ?? "";
}
