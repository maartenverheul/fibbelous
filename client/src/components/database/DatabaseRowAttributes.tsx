import { useEffect, useState } from "react";
import { PiClock } from "react-icons/pi";
import {
  formatDatabaseTimestamp,
  getAttributeValue,
  getRowPropertyValue,
  setAttributeValue,
} from "../../lib/database/attributes";
import { fetchDatabaseDetail } from "../../lib/database/fetch";
import { databasePropertyTypeIcon } from "../../lib/database/propertyIcons";
import {
  parseDatabaseSchema,
  type DatabasePropertyColumn,
  type DatabaseSchema,
} from "../../lib/database/types";
import {
  DatabaseCheckboxValue,
  isCheckboxChecked,
  isCheckboxPropertyType,
} from "./DatabaseCheckboxValue";
import { isSelectPropertyType } from "./DatabaseSelectChips";
import { DatabaseSelectOptionPicker } from "./DatabaseSelectOptionPicker";

const READONLY_TYPES = new Set<DatabasePropertyColumn["type"]>([
  "formula",
  "rollup",
  "created_time",
  "created_by",
  "last_edited_time",
  "last_edited_by",
]);

type DatabaseRowAttributesProps = {
  pageId: string;
  databaseId: string;
  attributes?: Record<string, unknown>;
  created?: string | null;
  edited?: string | null;
  readOnly?: boolean;
  onChange?: (attributes: Record<string, unknown>) => void;
};

function formatReadonlyValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "")).filter(Boolean).join(", ") || "—";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "—";
    }
  }
  return String(value);
}

function formatTimestamp(value: string | null | undefined): string {
  return formatDatabaseTimestamp(value) || "—";
}

function toDateInputValue(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  // Accept ISO date or datetime; date inputs want YYYY-MM-DD.
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? "";
}

function complexToText(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function parseComplexText(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

const inputClassName =
  "min-h-8 w-full min-w-0 rounded-md border-none bg-transparent px-1.5 py-1 text-base text-app-fg outline-none placeholder:text-app-fg-muted hover:bg-app-border/40 focus:bg-app-border/35";

export function DatabaseRowAttributes({
  pageId,
  databaseId,
  attributes: attributesProp,
  created,
  edited,
  readOnly,
  onChange,
}: DatabaseRowAttributesProps) {
  const attrs = attributesProp ?? {};
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const detail = await fetchDatabaseDetail(databaseId);
        if (cancelled || !detail) return;
        setSchema(parseDatabaseSchema(detail.json));
      } catch {
        if (!cancelled) setSchema(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [databaseId]);

  const commit = (property: DatabasePropertyColumn, value: unknown) => {
    if (readOnly || !onChange) return;
    onChange(setAttributeValue(attrs, property, value));
  };

  if (!schema) {
    return (
      <div
        className="mb-6 min-h-8 animate-pulse rounded bg-stone-100 dark:bg-stone-800"
        aria-busy
        aria-label="Loading attributes"
      />
    );
  }

  const properties = schema.properties.filter(
    (property) => property.type !== "title",
  );

  return (
    <div key={pageId} className="mb-8" role="table" aria-label="Page attributes">
      {properties.map((property) => {
        const TypeIcon = databasePropertyTypeIcon(property.type);
        const value =
          property.type === "created_time" ||
          property.type === "last_edited_time"
            ? getRowPropertyValue(
                {
                  title: null,
                  created: created ?? null,
                  edited: edited ?? null,
                  attributes: attrs,
                },
                property,
              )
            : getAttributeValue(attrs, property);
        const propertyReadOnly =
          Boolean(readOnly) || READONLY_TYPES.has(property.type);

        return (
          <div
            key={property.id}
            role="row"
            className="grid grid-cols-[minmax(8rem,11rem)_minmax(0,1fr)] items-center gap-2 py-0.5"
          >
            <div
              role="cell"
              className="flex min-w-0 items-center gap-2 text-sm text-app-fg-muted"
            >
              <TypeIcon className="size-4 shrink-0" aria-hidden />
              <span className="truncate" title={property.name}>
                {property.name}
              </span>
            </div>
            <div role="cell" className="min-w-0">
              {property.type === "created_time" ||
              property.type === "last_edited_time" ? (
                <span className="block px-1.5 py-1 text-sm text-app-fg-muted">
                  {formatTimestamp(
                    typeof value === "string" ? value : undefined,
                  )}
                </span>
              ) : (
                <AttributeValueEditor
                  property={property}
                  value={value}
                  readOnly={propertyReadOnly}
                  onChange={(next) => commit(property, next)}
                />
              )}
            </div>
          </div>
        );
      })}

      {!properties.some((property) => property.type === "created_time") && (
        <div
          role="row"
          className="grid grid-cols-[minmax(8rem,11rem)_minmax(0,1fr)] items-center gap-2 py-0.5"
        >
          <div
            role="cell"
            className="flex min-w-0 items-center gap-2 text-sm text-app-fg-muted"
          >
            <PiClock className="size-4 shrink-0" aria-hidden />
            <span>Created</span>
          </div>
          <div role="cell" className="px-1.5 py-1 text-sm text-app-fg-muted">
            {formatTimestamp(created)}
          </div>
        </div>
      )}
      {!properties.some((property) => property.type === "last_edited_time") && (
        <div
          role="row"
          className="grid grid-cols-[minmax(8rem,11rem)_minmax(0,1fr)] items-center gap-2 py-0.5"
        >
          <div
            role="cell"
            className="flex min-w-0 items-center gap-2 text-sm text-app-fg-muted"
          >
            <PiClock className="size-4 shrink-0" aria-hidden />
            <span>Edited</span>
          </div>
          <div role="cell" className="px-1.5 py-1 text-sm text-app-fg-muted">
            {formatTimestamp(edited)}
          </div>
        </div>
      )}
    </div>
  );
}

function AttributeValueEditor({
  property,
  value,
  readOnly,
  onChange,
}: {
  property: DatabasePropertyColumn;
  value: unknown;
  readOnly: boolean;
  onChange: (next: unknown) => void;
}) {
  if (isSelectPropertyType(property.type)) {
    return (
      <DatabaseSelectOptionPicker
        value={value}
        options={property.options}
        multiple={property.type === "multi_select"}
        readOnly={readOnly}
        ariaLabel={property.name}
        onChange={onChange}
      />
    );
  }

  if (isCheckboxPropertyType(property.type)) {
    const checked = isCheckboxChecked(value);
    if (readOnly) {
      return <DatabaseCheckboxValue value={value} />;
    }
    return (
      <label className="inline-flex min-h-8 items-center px-1.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="size-4 accent-app-fg"
          aria-label={property.name}
        />
      </label>
    );
  }

  if (READONLY_TYPES.has(property.type)) {
    return (
      <span className="block px-1.5 py-1 text-sm text-app-fg-muted">
        {formatReadonlyValue(value)}
      </span>
    );
  }

  if (property.type === "number") {
    const text =
      value == null || value === ""
        ? ""
        : typeof value === "number"
          ? String(value)
          : String(value);
    return (
      <input
        type="number"
        value={text}
        readOnly={readOnly}
        aria-label={property.name}
        className={inputClassName}
        onChange={(event) => {
          const raw = event.target.value;
          if (!raw.trim()) {
            onChange(null);
            return;
          }
          const num = Number(raw);
          onChange(Number.isFinite(num) ? num : raw);
        }}
      />
    );
  }

  if (property.type === "date") {
    return (
      <input
        type="date"
        value={toDateInputValue(value)}
        readOnly={readOnly}
        aria-label={property.name}
        className={inputClassName}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next ? next : null);
        }}
      />
    );
  }

  if (
    property.type === "people" ||
    property.type === "files" ||
    property.type === "relation"
  ) {
    return (
      <input
        type="text"
        value={complexToText(value)}
        readOnly={readOnly}
        aria-label={property.name}
        className={inputClassName}
        placeholder="Empty"
        onChange={(event) => onChange(parseComplexText(event.target.value))}
        onBlur={(event) => onChange(parseComplexText(event.target.value))}
      />
    );
  }

  // rich_text, url, email, phone_number, and unknown
  const text = value == null ? "" : String(value);
  return (
    <input
      type={
        property.type === "email"
          ? "email"
          : property.type === "url"
            ? "url"
            : property.type === "phone_number"
              ? "tel"
              : "text"
      }
      value={text}
      readOnly={readOnly}
      aria-label={property.name}
      className={inputClassName}
      placeholder="Empty"
      onChange={(event) => onChange(event.target.value || null)}
    />
  );
}
