import type { WorkspacePage } from "../page/types";

export type WorkspaceDatabaseDetail = {
  id: string;
  slug: string | null;
  name: string | null;
  path: string;
  json: unknown;
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

/**
 * A named layout over database rows.
 * `filter` is reserved for later; stored but unused for now.
 */
export type DatabaseViewSettings = {
  layout: DatabaseViewLayout;
  sort?: DatabaseViewSort | null;
  filter?: unknown;
};

export type DatabaseView = {
  id: string;
  name: string;
  settings: DatabaseViewSettings;
};

export type DatabaseSchema = {
  id: string;
  slug: string | null;
  title: string | null;
  properties: DatabasePropertyColumn[];
  views: DatabaseView[];
};

export const DEFAULT_DATABASE_VIEW: DatabaseView = {
  id: "default",
  name: "All",
  settings: {
    layout: "table",
  },
};

export const DEFAULT_DATABASE_LIST_VIEW: DatabaseView = {
  id: "default-list",
  name: "List",
  settings: {
    layout: "list",
  },
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

function parseView(raw: unknown, index: number): DatabaseView | null {
  const record = asRecord(raw);
  if (!record) return null;

  const settingsRoot = asRecord(record.settings) ?? {};
  const layout = parseViewLayout(
    settingsRoot.layout ?? record.layout,
  );

  const id = readString(record.id) ?? `view-${index + 1}`;
  const name =
    readString(record.name) ??
    readString(settingsRoot.name) ??
    `View ${index + 1}`;

  const settings: DatabaseViewSettings = {
    layout,
  };
  const sort = parseViewSort(settingsRoot.sort);
  if (sort) settings.sort = sort;
  if ("filter" in settingsRoot) settings.filter = settingsRoot.filter;

  return { id, name, settings };
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
    return DEFAULT_DATABASE_VIEWS.map((view) => ({
      ...view,
      settings: { ...view.settings },
    }));
  }

  const views = raw
    .map((item, index) => parseView(item, index))
    .filter((view): view is DatabaseView => view !== null);

  if (views.length === 0) {
    return DEFAULT_DATABASE_VIEWS.map((view) => ({
      ...view,
      settings: { ...view.settings },
    }));
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
    properties,
    views: parseDatabaseViews(root.views),
  };
}

/** Properties shown as columns in table/list views (`disable: true` excluded). */
export function databaseViewProperties(
  properties: DatabasePropertyColumn[],
): DatabasePropertyColumn[] {
  return properties.filter((property) => !property.disable);
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
