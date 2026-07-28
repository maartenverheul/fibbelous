import { useEffect, useRef, useState, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  PiArrowDown,
  PiArrowUp,
  PiArrowsDownUp,
  PiFunnel,
  PiGear,
  PiListBullets,
  PiPlus,
  PiTable,
} from "react-icons/pi";
import {
  formatDatabaseTimestamp,
  getRowPropertyValue,
} from "../../lib/database/attributes";
import {
  createDatabaseRow,
  fetchDatabaseRows,
  updateDatabaseView,
  type DatabaseViewUpdate,
} from "../../lib/database/fetch";
import { openWorkspacePage, findWorkspacePageById } from "../../lib/page/navigate";
import { resolveDatabaseViewId } from "../../lib/database/block";
import {
  getStoredDatabaseViewId,
  setStoredDatabaseViewId,
} from "../../lib/database/viewStorage";
import { databasePropertyTypeIcon } from "../../lib/database/propertyIcons";
import {
  dbCellEmpty,
  dbColName,
  dbListItem,
  dbListItemAttr,
  dbListItemAttrs,
  dbListItemButton,
  dbListItemTitle,
  dbListItems,
  dbMutedText,
  dbRoot,
  dbRootInline,
  dbScroll,
  dbScrollInline,
  dbSentinel,
  dbTable,
  dbTd,
  dbTdTitle,
  dbTh,
  dbThTitle,
  dbTitleCell,
  dbTitleCellText,
  dbTableRow,
  dbOpenBtn,
} from "../../lib/database/ui";
import { cn, getScrollParent, isInVerticalScrollport } from "../../lib/utils";
import {
  databaseDisplayIcon,
  databaseDisplayTitle,
  databaseViewProperties,
  pageFromDatabaseRow,
  parseDatabaseSchema,
  type DatabasePropertyColumn,
  type DatabaseRowSummary,
  type DatabaseSchema,
  type DatabaseView,
  type DatabaseViewSort,
  type WorkspaceDatabaseDetail,
} from "../../lib/database/types";
import { pageLabel } from "../../lib/page/types";
import { EmojiIcon } from "../emoji/EmojiIcon";
import { isIconUrl } from "../../lib/emojiIcon";
import {
  DatabaseSelectChips,
  isSelectPropertyType,
} from "./DatabaseSelectChips";
import {
  DatabaseCheckboxValue,
  isCheckboxPropertyType,
} from "./DatabaseCheckboxValue";
import { resolveSelectTokens } from "../../lib/database/select";

const ROW_PAGE_SIZE = 50;

export type DatabaseHostVariant = "page" | "inline";

type DatabaseDisplayProps = {
  detail: WorkspaceDatabaseDetail;
  schema: DatabaseSchema;
  variant?: DatabaseHostVariant;
  className?: string;
};

export function DatabaseDisplay({
  detail: detailProp,
  schema: schemaProp,
  variant = "page",
  className,
}: DatabaseDisplayProps) {
  const [detail, setDetail] = useState(detailProp);
  const [schema, setSchema] = useState(schemaProp);
  const [activeViewId, setActiveViewId] = useState(() =>
    resolveDatabaseViewId(
      schemaProp.views,
      getStoredDatabaseViewId(schemaProp.id),
    ),
  );
  const [creating, setCreating] = useState(false);
  const [savingView, setSavingView] = useState(false);
  const activeView =
    schema.views.find((view) => view.id === activeViewId) ?? schema.views[0];
  const title = databaseDisplayTitle(detail, schema);
  const activeSort = activeView?.settings.sort ?? null;
  const viewProperties = databaseViewProperties(schema.properties);
  const hostPage = findWorkspacePageById(schema.id);
  const icon = databaseDisplayIcon(schema, hostPage?.icon);
  const inline = variant === "inline";

  useEffect(() => {
    setDetail(detailProp);
    setSchema(schemaProp);
    setActiveViewId(
      resolveDatabaseViewId(
        schemaProp.views,
        getStoredDatabaseViewId(schemaProp.id),
      ),
    );
  }, [detailProp, schemaProp]);

  useEffect(() => {
    setActiveViewId((prev) => resolveDatabaseViewId(schema.views, prev));
  }, [schema.views]);

  const selectView = (id: string) => {
    if (id === activeViewId) return;
    setActiveViewId(id);
    setStoredDatabaseViewId(schema.id, id);
  };

  const handleNew = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const page = await createDatabaseRow(schema.id);
      openWorkspacePage(page);
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error ? error.message : "Failed to create database row",
      );
    } finally {
      setCreating(false);
    }
  };

  const applyViewUpdate = async (update: DatabaseViewUpdate) => {
    if (!activeView || savingView) return false;
    setSavingView(true);
    try {
      const nextDetail = await updateDatabaseView(
        schema.id,
        activeView.id,
        update,
      );
      const nextSchema = parseDatabaseSchema(nextDetail.json);
      if (!nextSchema) {
        throw new Error("Invalid database.json");
      }
      setDetail(nextDetail);
      setSchema(nextSchema);
      return true;
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error ? error.message : "Failed to update view",
      );
      return false;
    } finally {
      setSavingView(false);
    }
  };

  const applySort = async (sort: DatabaseViewSort | null) => {
    if (!activeView || savingView) return;
    const same =
      (sort == null && activeSort == null) ||
      (sort != null &&
        activeSort != null &&
        sort.property === activeSort.property &&
        sort.direction === activeSort.direction);
    if (same) return;
    await applyViewUpdate({ sort });
  };

  const applyName = async (name: string) => {
    if (!activeView || savingView) return false;
    const trimmed = name.trim();
    if (!trimmed || trimmed === activeView.name) return true;
    return applyViewUpdate({ name: trimmed });
  };

  return (
    <div
      className={cn(inline ? dbRootInline : dbRoot, className)}
      data-database-id={schema.id}
      title={detail.path}
    >
      <div
        className={cn(
          "mb-3 gap-x-4 gap-y-2",
          inline
            ? "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center"
            : "flex flex-wrap items-center justify-between",
        )}
      >
        <DatabaseViewTabs
          views={schema.views}
          activeViewId={activeView?.id ?? ""}
          onSelect={selectView}
        />
        {inline ? (
          <DatabaseInlineHeading title={title} icon={icon} />
        ) : null}
        <DatabaseViewControls
          creating={creating}
          savingView={savingView}
          properties={viewProperties}
          viewName={activeView?.name ?? ""}
          sort={activeSort}
          onSortChange={(next) => void applySort(next)}
          onNameChange={(name) => applyName(name)}
          onNew={() => void handleNew()}
          className={inline ? "justify-self-end" : undefined}
        />
      </div>
      {!activeView || viewProperties.length === 0 ? (
        <div className={dbMutedText}>
          {viewProperties.length === 0
            ? "No properties defined"
            : "No view selected"}
        </div>
      ) : (
        <DatabaseViewBody
          databaseId={schema.id}
          view={activeView}
          properties={viewProperties}
          title={title}
          sort={activeSort}
          scrollClassName={inline ? dbScrollInline : dbScroll}
        />
      )}
    </div>
  );
}

function DatabaseInlineHeading({
  title,
  icon,
}: {
  title: string;
  icon: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center justify-center gap-2 justify-self-center px-1 text-center">
      <span
        className="inline-flex size-5 shrink-0 items-center justify-center text-[1.05rem] leading-none text-app-fg-muted"
        aria-hidden
      >
        {icon && isIconUrl(icon) ? (
          <img src={icon} alt="" className="size-5 object-contain" />
        ) : icon ? (
          icon
        ) : (
          <PiTable className="size-5" />
        )}
      </span>
      <span
        className="min-w-0 truncate text-sm font-semibold text-app-fg"
        title={title}
      >
        {title}
      </span>
    </div>
  );
}

function DatabaseViewTabs({
  views,
  activeViewId,
  onSelect,
}: {
  views: DatabaseView[];
  activeViewId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-1.5"
      role="tablist"
      aria-label="Database views"
    >
      {views.map((view) => {
        const selected = view.id === activeViewId;
        const Icon =
          view.settings.layout === "list" ? PiListBullets : PiTable;
        return (
          <button
            key={view.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium",
              selected
                ? "bg-app-border/70 text-app-fg"
                : "bg-app-border/35 text-app-fg-muted hover:bg-app-border/55 hover:text-app-fg",
            )}
            onClick={() => onSelect(view.id)}
          >
            <Icon className="size-[0.95em] shrink-0" aria-hidden />
            <span>{view.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function DatabaseViewControls({
  creating,
  savingView,
  properties,
  viewName,
  sort,
  onSortChange,
  onNameChange,
  onNew,
  className,
}: {
  creating: boolean;
  savingView: boolean;
  properties: DatabasePropertyColumn[];
  viewName: string;
  sort: DatabaseViewSort | null;
  onSortChange: (sort: DatabaseViewSort | null) => void;
  onNameChange: (name: string) => Promise<boolean>;
  onNew: () => void;
  className?: string;
}) {
  const controlBtnClass = cn(
    "inline-flex size-8 items-center justify-center rounded-md text-app-fg-muted",
    "hover:bg-app-border/45 hover:text-app-fg",
    "disabled:cursor-not-allowed disabled:opacity-45",
  );

  return (
    <div className={cn("ml-auto flex flex-wrap items-center gap-1.5", className)}>
      <button
        type="button"
        className={controlBtnClass}
        aria-label="Filter"
        title="Filter (coming soon)"
        disabled
      >
        <PiFunnel className="size-[1.05rem] shrink-0" aria-hidden />
      </button>
      <DatabaseSortPopover
        properties={properties}
        sort={sort}
        disabled={savingView || properties.length === 0}
        onSortChange={onSortChange}
        triggerClassName={controlBtnClass}
      />
      <DatabaseSettingsPopover
        viewName={viewName}
        disabled={savingView}
        onNameChange={onNameChange}
        triggerClassName={controlBtnClass}
      />
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-[0.8125rem] font-semibold text-white",
          "hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70",
        )}
        onClick={onNew}
        disabled={creating}
      >
        <PiPlus className="size-[1.05rem] shrink-0" aria-hidden />
        <span>{creating ? "Creating…" : "New"}</span>
      </button>
    </div>
  );
}

function DatabaseSettingsPopover({
  viewName,
  disabled,
  onNameChange,
  triggerClassName,
}: {
  viewName: string;
  disabled: boolean;
  onNameChange: (name: string) => Promise<boolean>;
  triggerClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState(viewName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraftName(viewName);
  }, [open, viewName]);

  const commitName = async () => {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === viewName || saving || disabled) {
      setDraftName(viewName);
      return;
    }
    setSaving(true);
    try {
      const ok = await onNameChange(trimmed);
      if (!ok) setDraftName(viewName);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            triggerClassName,
            open &&
              "bg-app-border/45 text-app-fg",
          )}
          aria-label="View settings"
          title="View settings"
          disabled={disabled}
        >
          <PiGear className="size-[1.05rem] shrink-0" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={6}
          className={cn(
            "z-50 w-64 rounded-lg border border-app-border bg-app-surface p-3",
            "shadow-lg outline-none",
          )}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-app-fg">
              View settings
            </h3>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-app-fg-muted">
                Name
              </span>
              <input
                type="text"
                value={draftName}
                disabled={saving || disabled}
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={() => void commitName()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void commitName();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setDraftName(viewName);
                    setOpen(false);
                  }
                }}
                className={cn(
                  "w-full rounded-md border border-app-border bg-app-bg px-2.5 py-1.5",
                  "text-base text-app-fg outline-none",
                  "focus:border-blue-500 focus:ring-1 focus:ring-blue-500",
                  "disabled:opacity-60",
                )}
              />
            </label>
          </section>
          <Popover.Arrow className="fill-app-surface" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function DatabaseSortPopover({
  properties,
  sort,
  disabled,
  onSortChange,
  triggerClassName,
}: {
  properties: DatabasePropertyColumn[];
  sort: DatabaseViewSort | null;
  disabled: boolean;
  onSortChange: (sort: DatabaseViewSort | null) => void;
  triggerClassName: string;
}) {
  const hasSort = sort != null;
  const [open, setOpen] = useState(false);

  const selectProperty = (propertyId: string) => {
    if (sort?.property !== propertyId) {
      onSortChange({ property: propertyId, direction: "asc" });
      return;
    }
    if (sort.direction === "asc") {
      onSortChange({ property: propertyId, direction: "desc" });
      return;
    }
    onSortChange(null);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            triggerClassName,
            hasSort &&
              "text-blue-600 hover:bg-blue-500/10 hover:text-blue-700",
            open &&
              (hasSort
                ? "bg-blue-500/10 text-blue-700"
                : "bg-app-border/45"),
          )}
          aria-label="Sort"
          title="Sort"
          disabled={disabled}
        >
          <PiArrowsDownUp className="size-[1.05rem] shrink-0" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={6}
          className={cn(
            "z-50 w-64 rounded-lg border border-app-border bg-app-surface p-2",
            "shadow-lg outline-none",
          )}
        >
          <p className="px-1.5 pb-1.5 pt-0.5 text-sm font-medium text-app-fg">
            Sort
          </p>
          <ul className="app-scroll m-0 max-h-64 list-none overflow-y-auto p-0">
            {properties.map((property) => {
              const selected = sort?.property === property.id;
              const TypeIcon = databasePropertyTypeIcon(property.type);
              const DirectionIcon =
                sort?.direction === "desc" ? PiArrowDown : PiArrowUp;
              return (
                <li key={property.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                      selected
                        ? "bg-app-border/55 text-app-fg"
                        : "text-app-fg hover:bg-app-border/40",
                    )}
                    onClick={() => selectProperty(property.id)}
                  >
                    <TypeIcon
                      className="size-3.5 shrink-0 text-app-fg-muted"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {property.name}
                    </span>
                    {selected ? (
                      <DirectionIcon
                        className="size-3.5 shrink-0 text-app-fg"
                        aria-hidden
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <Popover.Arrow className="fill-app-surface" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function DatabaseViewBody({
  databaseId,
  view,
  properties,
  title,
  sort,
  scrollClassName,
}: {
  databaseId: string;
  view: DatabaseView;
  properties: DatabasePropertyColumn[];
  title: string;
  sort: DatabaseViewSort | null;
  scrollClassName: string;
}) {
  const { rows, status, error, scrollerRef, sentinelRef } = useDatabaseRows(
    databaseId,
    sort,
  );

  if (view.settings.layout === "list") {
    return (
      <div className={scrollClassName} ref={scrollerRef} aria-label={`${title} · ${view.name}`}>
        {status === "loading" && rows.length === 0 ? (
          <div className={dbMutedText}>Loading…</div>
        ) : rows.length === 0 ? (
          <div className={dbMutedText}>{error ?? "No rows yet"}</div>
        ) : (
          <ul className={dbListItems}>
            {rows.map((row) => {
              const page = pageFromDatabaseRow(row);
              const label = pageLabel(page);
              const attrs = listRowAttributes(row, properties);
              return (
                <li key={row.id} className={dbListItem}>
                  <button
                    type="button"
                    className={dbListItemButton}
                    onClick={() => openWorkspacePage(page)}
                  >
                    {page.icon ? (
                      <EmojiIcon
                        icon={page.icon}
                        size={18}
                        className="shrink-0 leading-none"
                      />
                    ) : null}
                    <span className={dbListItemTitle}>{label}</span>
                    {attrs.length > 0 ? (
                      <span className={dbListItemAttrs}>
                        {attrs.map((attr) => (
                          <span
                            key={attr.id}
                            className={dbListItemAttr}
                            title={
                              typeof attr.display === "string"
                                ? attr.display
                                : undefined
                            }
                          >
                            {attr.node}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={sentinelRef} className={dbSentinel} aria-hidden />
        {status === "loading" && rows.length > 0 && (
          <div className={dbMutedText}>Loading more…</div>
        )}
      </div>
    );
  }

  return (
    <div className={scrollClassName} ref={scrollerRef}>
      <table className={dbTable} aria-label={`${title} · ${view.name}`}>
        <thead>
          <tr>
            {properties.map((property) => (
              <th
                key={property.id}
                scope="col"
                data-property-id={property.id}
                data-property-type={property.type}
                className={cn(
                  dbTh,
                  property.type === "title" && dbThTitle,
                )}
              >
                <span className={dbColName}>{property.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && status !== "loading" ? (
            <tr>
              <td
                className={dbCellEmpty}
                colSpan={Math.max(properties.length, 1)}
              >
                {error ?? "No rows yet"}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const page = pageFromDatabaseRow(row);
              return (
                <tr key={row.id} className={dbTableRow}>
                  {properties.map((property) => (
                    <td
                      key={property.id}
                      data-property-type={property.type}
                      className={cn(
                        dbTd,
                        property.type === "title" && dbTdTitle,
                      )}
                    >
                      {property.type === "title" ? (
                        <div className={dbTitleCell}>
                          <span className={dbTitleCellText}>
                            {formatPropertyValue(
                              property,
                              rowCellValue(row, property),
                            )}
                          </span>
                          <button
                            type="button"
                            className={dbOpenBtn}
                            onClick={() => openWorkspacePage(page)}
                          >
                            Open
                          </button>
                        </div>
                      ) : (
                        formatPropertyValue(
                          property,
                          rowCellValue(row, property),
                        )
                      )}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      <div ref={sentinelRef} className={dbSentinel} aria-hidden />
      {status === "loading" && (
        <div className={dbMutedText}>
          {rows.length === 0 ? "Loading…" : "Loading more…"}
        </div>
      )}
    </div>
  );
}

function sortKey(sort: DatabaseViewSort | null): string {
  if (!sort) return "";
  return `${sort.property}:${sort.direction}`;
}

function useDatabaseRows(
  databaseId: string,
  sort: DatabaseViewSort | null,
) {
  const [rows, setRows] = useState<DatabaseRowSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const sortRef = useRef(sort);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const activeSortKey = sortKey(sort);

  sortRef.current = sort;

  const loadMore = async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setStatus("loading");

    try {
      const page = await fetchDatabaseRows(databaseId, {
        limit: ROW_PAGE_SIZE,
        offset: offsetRef.current,
        sort: sortRef.current,
      });

      if (!page) {
        setError("Database not found");
        setStatus("error");
        hasMoreRef.current = false;
        setHasMore(false);
        return;
      }

      if (page.rows.length === 0) {
        hasMoreRef.current = false;
        setHasMore(false);
        setStatus("ready");
        return;
      }

      setRows((prev) =>
        offsetRef.current === 0 ? page.rows : [...prev, ...page.rows],
      );
      offsetRef.current += page.rows.length;
      hasMoreRef.current = page.hasMore;
      setHasMore(page.hasMore);
      setError(null);
      setStatus("ready");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load rows",
      );
      setStatus("error");
    } finally {
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    offsetRef.current = 0;
    hasMoreRef.current = true;
    loadingRef.current = false;
    setRows([]);
    setHasMore(true);
    setError(null);
    setStatus("loading");
    void loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when database or sort changes
  }, [databaseId, activeSortKey]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const root = getScrollParent(sentinel);
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        void loadMore();
      },
      { root, rootMargin: "120px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [databaseId, activeSortKey, hasMore]);

  // After each page, keep fetching only while the sentinel is still in view
  // (first batches may not fill the scrollport). Stop once it leaves.
  useEffect(() => {
    if (!hasMore || status === "loading" || rows.length === 0) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    if (!isInVerticalScrollport(sentinel, 120)) return;
    void loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, hasMore, status]);

  return {
    rows,
    status,
    hasMore,
    error,
    loadMore,
    scrollerRef,
    sentinelRef,
  };
}

function listRowAttributes(
  row: DatabaseRowSummary,
  properties: DatabasePropertyColumn[],
): {
  id: string;
  display: string | undefined;
  node: ReactNode;
}[] {
  const attrs: {
    id: string;
    display: string | undefined;
    node: ReactNode;
  }[] = [];
  for (const property of properties) {
    if (property.type === "title") continue;
    const value = rowCellValue(row, property);
    const node = formatPropertyValue(property, value);
    if (node == null || node === "") continue;
    attrs.push({
      id: property.id,
      display:
        isSelectPropertyType(property.type) ||
        isCheckboxPropertyType(property.type)
          ? undefined
          : property.type === "created_time" ||
              property.type === "last_edited_time"
            ? formatDatabaseTimestamp(value) || undefined
            : formatCellValue(value) || undefined,
      node,
    });
  }
  return attrs;
}

function formatPropertyValue(
  property: DatabasePropertyColumn,
  value: unknown,
): ReactNode {
  if (isSelectPropertyType(property.type)) {
    if (resolveSelectTokens(value, property.options).length === 0) {
      return null;
    }
    return <DatabaseSelectChips value={value} options={property.options} />;
  }
  if (isCheckboxPropertyType(property.type) || typeof value === "boolean") {
    return <DatabaseCheckboxValue value={value} />;
  }
  if (
    property.type === "created_time" ||
    property.type === "last_edited_time"
  ) {
    const text = formatDatabaseTimestamp(value);
    return text || null;
  }
  const text = formatCellValue(value);
  return text || null;
}

function rowCellValue(
  row: DatabaseRowSummary,
  property: DatabasePropertyColumn,
): unknown {
  return getRowPropertyValue(row, property);
}

function formatCellValue(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    return value
      .map((item) => (item == null ? "" : String(item)))
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
