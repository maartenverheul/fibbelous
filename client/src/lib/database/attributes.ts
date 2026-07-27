import type {
  DatabasePropertyColumn,
  DatabaseRowSummary,
} from "./types";

/** Candidate keys for a property in a row's `properties` map (id preferred). */
function propertyAttributeKeys(property: DatabasePropertyColumn): string[] {
  const keys = [property.id, property.key, property.name];
  return keys.filter(
    (key, index) => key.length > 0 && keys.indexOf(key) === index,
  );
}

/** Find the attribute key for a property. Prefers `id`, then map key, then name. */
export function findAttributeKey(
  attrs: Record<string, unknown>,
  property: DatabasePropertyColumn,
): string | null {
  for (const candidate of propertyAttributeKeys(property)) {
    if (Object.prototype.hasOwnProperty.call(attrs, candidate)) {
      return candidate;
    }
  }

  // Fall back to case-insensitive match for differently cased legacy keys.
  const candidatesLower = new Set(
    propertyAttributeKeys(property).map((key) => key.toLowerCase()),
  );
  for (const key of Object.keys(attrs)) {
    if (candidatesLower.has(key.toLowerCase())) return key;
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
 * Set or clear a property value. Keys use the property `id` from
 * `database.json`. Name / map-key legacy entries are migrated on write.
 */
export function setAttributeValue(
  attrs: Record<string, unknown>,
  property: DatabasePropertyColumn,
  value: unknown,
): Record<string, unknown> {
  const next = { ...attrs };
  const existingKey = findAttributeKey(attrs, property);
  const writeKey = property.id;

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
