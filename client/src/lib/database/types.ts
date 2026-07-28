import type { WorkspacePage, WorkspacePageDetail } from "../page/types";

export type WorkspaceDatabaseDetail = {
  id: string;
  slug: string | null;
  name: string | null;
  path: string;
  json: unknown;
};

/** Summary row from `list_databases` (no full schema json). */
export type WorkspaceDatabaseMeta = {
  id: string;
  slug: string | null;
  name: string | null;
  path: string;
};

export type CreateDatabaseResult = {
  database: WorkspaceDatabaseDetail;
  page?: WorkspacePageDetail | null;
};

export type DatabaseRowSummary = {
  id: string;
  slug: string | null;
  title: string | null;
  icon: string | null;
  created: string | null;
  edited: string | null;
  attributes: Record<string, unknown>;
  path: string;
  databaseId: string;
};

/** Treat a database row as a navigable workspace page. */
export function pageFromDatabaseRow(row: DatabaseRowSummary): WorkspacePage {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    icon: row.icon,
    path: row.path,
    hasChildren: false,
    databaseId: row.databaseId,
  };
}

export type DatabaseRowsPage = {
  rows: DatabaseRowSummary[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};

/** On-disk databases/{id}/database.json shape (field order matches serialization). */
export type DatabaseFile = {
  id: string;
  slug?: string | null;
  title?: string | null;
  name?: string | null;
  created?: string | null;
  edited?: string | null;
  properties: Record<string, DatabaseProperty>;
  views?: DatabaseView[];
};

export type DatabaseProperty = {
  id: string;
  name: string;
  description?: string | null;
  /** When true, the property is omitted from database views. */
  disable?: boolean;
} & DatabasePropertyConfig;

export type EmptyObject = Record<string, never>;

export type SelectOption = {
  id: string;
  name: string;
  color: string;
  description?: string | null;
};

export type OptionsConfig = {
  options: SelectOption[];
};

export type StatusGroup = {
  id: string;
  name: string;
  color: string;
  option_ids: string[];
};

export type StatusConfig = {
  options: SelectOption[];
  groups?: StatusGroup[];
};

export type NumberConfig = {
  format: string;
};

export type FormulaConfig = {
  expression: string;
};

export type DualPropertyConfig = {
  synced_property_name: string;
  synced_property_id: string;
};

export type SinglePropertyConfig = {
  synced_property_name: string;
  synced_property_id: string;
};

export type RelationConfig = {
  database_id: string;
  data_source_id?: string;
  type: "dual_property" | "single_property";
  dual_property?: DualPropertyConfig;
  single_property?: SinglePropertyConfig;
};

export type DatabasePropertyConfig =
  | { type: "title"; title: EmptyObject }
  | { type: "rich_text"; rich_text: EmptyObject }
  | { type: "number"; number: NumberConfig }
  | { type: "select"; select: OptionsConfig }
  | { type: "multi_select"; multi_select: OptionsConfig }
  | { type: "status"; status: StatusConfig }
  | { type: "date"; date: EmptyObject }
  | { type: "people"; people: EmptyObject }
  | { type: "files"; files: EmptyObject }
  | { type: "checkbox"; checkbox: EmptyObject }
  | { type: "url"; url: EmptyObject }
  | { type: "email"; email: EmptyObject }
  | { type: "phone_number"; phone_number: EmptyObject }
  | { type: "formula"; formula: FormulaConfig }
  | { type: "relation"; relation: RelationConfig }
  | { type: "rollup"; rollup: EmptyObject }
  | { type: "created_time"; created_time: EmptyObject }
  | { type: "created_by"; created_by: EmptyObject }
  | { type: "last_edited_time"; last_edited_time: EmptyObject }
  | { type: "last_edited_by"; last_edited_by: EmptyObject };

/** Column summary used by the table UI (derived from DatabaseProperty). */
export type DatabasePropertyColumn = {
  key: string;
  id: string;
  name: string;
  type: DatabasePropertyConfig["type"];
  /** When true, the property is omitted from database views. */
  disable?: boolean;
  /** Present for select / multi_select (and similar option-backed types). */
  options?: SelectOption[];
};

export type DatabaseViewLayout = "table" | "list";

export type DatabaseSortDirection = "asc" | "desc";

export type DatabaseViewSort = {
  /** Property id from `database.json` properties. */
  property: string;
  direction: DatabaseSortDirection;
};

/** Per-view property order + visibility entry in `database.json`. */
export type DatabaseViewProperty = {
  id: string;
  visible: boolean;
};

/**
 * A named layout over database rows.
 * Fields live on the view object (no nested `settings` key).
 * `filter` is reserved for later; stored but unused for now.
 */
export type DatabaseView = {
  id: string;
  name: string;
  layout: DatabaseViewLayout;
  sort?: DatabaseViewSort | null;
  filter?: unknown;
  /** Ordered visibility list; absent = all non-disabled schema props shown. */
  properties?: DatabaseViewProperty[] | null;
};

export type DatabaseSchema = {
  id: string;
  slug: string | null;
  title: string | null;
  icon: string | null;
  properties: DatabasePropertyColumn[];
  views: DatabaseView[];
};

export const DEFAULT_DATABASE_VIEW: DatabaseView = {
  id: "default",
  name: "All",
  layout: "table",
};

export const DEFAULT_DATABASE_LIST_VIEW: DatabaseView = {
  id: "default-list",
  name: "List",
  layout: "list",
};

export const DEFAULT_DATABASE_VIEWS: DatabaseView[] = [
  DEFAULT_DATABASE_VIEW,
  DEFAULT_DATABASE_LIST_VIEW,
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseViewLayout(value: unknown): DatabaseViewLayout {
  return value === "list" ? "list" : "table";
}

function parseViewProperty(raw: unknown): DatabaseViewProperty | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = readString(record.id);
  if (!id) return null;
  return { id, visible: record.visible !== false };
}

function parseViewProperties(raw: unknown): DatabaseViewProperty[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const parsed = raw
    .map(parseViewProperty)
    .filter((item): item is DatabaseViewProperty => item !== null);
  return parsed.length > 0 ? parsed : null;
}

function parseView(raw: unknown, index: number): DatabaseView | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = readString(record.id) ?? `view-${index + 1}`;
  const name = readString(record.name) ?? `View ${index + 1}`;
  const layout = parseViewLayout(record.layout);

  const view: DatabaseView = { id, name, layout };
  const sort = parseViewSort(record.sort);
  if (sort) view.sort = sort;
  if ("filter" in record) view.filter = record.filter;
  const properties = parseViewProperties(record.properties);
  if (properties) view.properties = properties;

  return view;
}

function parseViewSort(raw: unknown): DatabaseViewSort | null {
  const record = asRecord(raw);
  if (!record) return null;
  const property = readString(record.property);
  if (!property) return null;
  const direction = record.direction === "asc" ? "asc" : "desc";
  return { property, direction };
}

/** Resolve views from JSON, or default table + list views when none are defined. */
export function parseDatabaseViews(raw: unknown): DatabaseView[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_DATABASE_VIEWS.map((view) => ({ ...view }));
  }

  const views = raw
    .map((item, index) => parseView(item, index))
    .filter((view): view is DatabaseView => view !== null);

  if (views.length === 0) {
    return DEFAULT_DATABASE_VIEWS.map((view) => ({ ...view }));
  }

  return views;
}

function parsePropertyType(value: unknown): DatabasePropertyConfig["type"] {
  if (typeof value !== "string" || !value.trim()) return "rich_text";
  return value as DatabasePropertyConfig["type"];
}

function parsePropertyOptions(
  prop: Record<string, unknown>,
  type: DatabasePropertyConfig["type"],
): SelectOption[] | undefined {
  if (type !== "select" && type !== "multi_select" && type !== "status") {
    return undefined;
  }
  const config = asRecord(prop[type]);
  if (!config || !Array.isArray(config.options)) return undefined;

  const options: SelectOption[] = [];
  for (const raw of config.options) {
    const option = asRecord(raw);
    if (!option) continue;
    const id = readString(option.id);
    const name = readString(option.name);
    if (!id || !name) continue;
    options.push({
      id,
      name,
      color: readString(option.color) ?? "default",
      ...(readString(option.description)
        ? { description: readString(option.description) }
        : {}),
    });
  }
  return options.length > 0 ? options : undefined;
}

/** Parse Notion-like `database.json` into columns + views (title column first). */
export function parseDatabaseSchema(json: unknown): DatabaseSchema | null {
  const root = asRecord(json);
  if (!root) return null;

  const id = readString(root.id);
  if (!id) return null;

  const propertiesRoot = asRecord(root.properties);
  const properties: DatabasePropertyColumn[] = [];

  if (propertiesRoot) {
    for (const [key, raw] of Object.entries(propertiesRoot)) {
      const prop = asRecord(raw);
      if (!prop) continue;

      const name = readString(prop.name) ?? key;
      const type = parsePropertyType(prop.type);
      const propId = readString(prop.id) ?? key;
      const options = parsePropertyOptions(prop, type);

      properties.push({
        key,
        id: propId,
        name,
        type,
        ...(prop.disable === true ? { disable: true } : {}),
        ...(options ? { options } : {}),
      });
    }

    // Stable sort: title column first, keep declaration order otherwise.
    properties.sort((a, b) => {
      if (a.type === "title" && b.type !== "title") return -1;
      if (b.type === "title" && a.type !== "title") return 1;
      return 0;
    });
  }

  return {
    id,
    slug: readString(root.slug),
    title: readString(root.title) ?? readString(root.name),
    icon: readString(root.icon),
    properties,
    views: parseDatabaseViews(root.views),
  };
}

/** Properties eligible for a view (`disable: true` excluded). */
export function databaseViewProperties(
  properties: DatabasePropertyColumn[],
): DatabasePropertyColumn[] {
  return properties.filter((property) => !property.disable);
}

/**
 * Resolve ordered shown/hidden property lists for a view.
 * New schema props (not yet in the stored list) append; created/edited
 * timestamp properties default to hidden.
 * Title always stays shown and locked first.
 */
export function resolveViewPropertyEntries(
  properties: DatabasePropertyColumn[],
  stored: DatabaseViewProperty[] | null | undefined,
): DatabaseViewProperty[] {
  const eligible = databaseViewProperties(properties);
  const byId = new Map(eligible.map((property) => [property.id, property]));
  const titleId =
    eligible.find((property) => property.type === "title")?.id ?? null;

  const seen = new Set<string>();
  const ordered: DatabaseViewProperty[] = [];

  if (stored) {
    for (const entry of stored) {
      if (!byId.has(entry.id) || seen.has(entry.id)) continue;
      seen.add(entry.id);
      const visible =
        titleId !== null && entry.id === titleId ? true : entry.visible;
      ordered.push({ id: entry.id, visible });
    }
  }

  for (const property of eligible) {
    if (seen.has(property.id)) continue;
    ordered.push({
      id: property.id,
      visible: !isViewPropertyHiddenByDefault(property),
    });
  }

  return pinTitlePropertyFirst(ordered, titleId);
}

/** Keep the title property visible and first in the view property list. */
export function pinTitlePropertyFirst(
  entries: DatabaseViewProperty[],
  titleId: string | null,
): DatabaseViewProperty[] {
  if (!titleId) return entries;
  const rest = entries.filter((entry) => entry.id !== titleId);
  const shown = rest.filter((entry) => entry.visible);
  const hidden = rest.filter((entry) => !entry.visible);
  return [
    { id: titleId, visible: true },
    ...shown,
    ...hidden,
  ];
}

/** Created / edited timestamp columns start hidden on new views. */
export function isViewPropertyHiddenByDefault(
  property: Pick<DatabasePropertyColumn, "type">,
): boolean {
  return (
    property.type === "created_time" || property.type === "last_edited_time"
  );
}

/** Visible properties for table/list rendering, in view order. */
export function resolveViewProperties(
  properties: DatabasePropertyColumn[],
  stored: DatabaseViewProperty[] | null | undefined,
): DatabasePropertyColumn[] {
  const byId = new Map(
    databaseViewProperties(properties).map((property) => [
      property.id,
      property,
    ]),
  );
  return resolveViewPropertyEntries(properties, stored)
    .filter((entry) => entry.visible)
    .map((entry) => byId.get(entry.id))
    .filter((property): property is DatabasePropertyColumn => property != null);
}

export function databaseDisplayTitle(
  detail: WorkspaceDatabaseDetail,
  schema: DatabaseSchema | null,
): string {
  return (
    schema?.title?.trim() ||
    detail.name?.trim() ||
    detail.slug?.trim() ||
    detail.id
  );
}

/** Prefer schema icon, then a host page with the same id. */
export function databaseDisplayIcon(
  schema: DatabaseSchema | null,
  hostIcon?: string | null,
): string | null {
  return schema?.icon?.trim() || hostIcon?.trim() || null;
}
