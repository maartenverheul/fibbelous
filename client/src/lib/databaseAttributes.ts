import type {
  DatabasePropertyColumn,
  DatabaseRowSummary,
} from "../types/database";

/** Find the attribute key for a property. Prefers the exact `name` from database.json. */
export function findAttributeKey(
  attrs: Record<string, unknown>,
  property: DatabasePropertyColumn,
): string | null {
  if (Object.hasOwn(attrs, property.name)) {
    return property.name;
  }
  if (property.key !== property.name && Object.hasOwn(attrs, property.key)) {
    return property.key;
  }

  // Fall back to case-insensitive match for differently cased legacy keys.
  const nameLower = property.name.toLowerCase();
  const keyLower = property.key.toLowerCase();
  for (const key of Object.keys(attrs)) {
    const lower = key.toLowerCase();
    if (lower === nameLower || lower === keyLower) return key;
  }
  return null;
}

export function getAttributeValue(
  attrs: Record<string, unknown>,
  property: DatabasePropertyColumn,
): unknown {
  const key = findAttributeKey(attrs, property);
  return key ? attrs[key] : undefined;
}

/**
 * Resolve a cell value for a database row. Title / created / edited use row
 * metadata; other types read from the properties map.
 */
export function getRowPropertyValue(
  row: Pick<DatabaseRowSummary, "title" | "created" | "edited" | "attributes">,
  property: DatabasePropertyColumn,
): unknown {
  if (property.type === "title") return row.title;

  const attrs =
    row.attributes && typeof row.attributes === "object" ? row.attributes : {};
  const fromAttrs = getAttributeValue(attrs, property);

  if (property.type === "created_time") {
    return fromAttrs ?? row.created ?? undefined;
  }
  if (property.type === "last_edited_time") {
    return fromAttrs ?? row.edited ?? undefined;
  }

  return fromAttrs;
}

/** Format an ISO / parseable timestamp for database UI. */
export function formatDatabaseTimestamp(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}


/**
 * Set or clear a property value. Keys use the property `name` casing from
 * `database.json`. Differently cased keys from older edits are migrated on write.
 */
export function setAttributeValue(
  attrs: Record<string, unknown>,
  property: DatabasePropertyColumn,
  value: unknown,
): Record<string, unknown> {
  const next = { ...attrs };
  const existingKey = findAttributeKey(attrs, property);
  const writeKey = property.name;

  if (value === null || value === undefined || value === "") {
    if (existingKey) delete next[existingKey];
    return next;
  }

  if (existingKey && existingKey !== writeKey) {
    delete next[existingKey];
  }
  next[writeKey] = value;
  return next;
}
