import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import * as Popover from "@radix-ui/react-popover";
import * as Select from "@radix-ui/react-select";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  PiArrowDown,
  PiArrowLeft,
  PiArrowUp,
  PiArrowsDownUp,
  PiCaretDown,
  PiCaretRight,
  PiCheck,
  PiCopy,
  PiDotsSixVertical,
  PiDotsThree,
  PiEye,
  PiEyeSlash,
  PiFunnel,
  PiGear,
  PiListBullets,
  PiPencilSimple,
  PiPlus,
  PiStar,
  PiTable,
  PiTrash,
} from "react-icons/pi";
import {
  formatDatabaseTimestamp,
  getRowPropertyValue,
} from "../../lib/database/attributes";
import {
  createDatabaseRow,
  createDatabaseTemplate,
  createDatabaseView,
  deleteDatabaseTemplate,
  deleteDatabaseView,
  duplicateDatabaseTemplate,
  fetchDatabaseRows,
  fetchDatabaseTemplate,
  setDefaultDatabaseTemplate,
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
  EMPTY_DATABASE_TEMPLATE_ID,
  pageFromDatabaseRow,
  parseDatabaseSchema,
  pinTitlePropertyFirst,
  resolveViewProperties,
  resolveViewPropertyEntries,
  type DatabasePropertyColumn,
  type DatabaseRowSummary,
  type DatabaseRowTemplate,
  type DatabaseSchema,
  type DatabaseView,
  type DatabaseViewLayout,
  type DatabaseViewProperty,
  type DatabaseViewSort,
  type WorkspaceDatabaseDetail,
} from "../../lib/database/types";
import { ConfirmDialog } from "../ui/ConfirmDialog";
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
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deletingView, setDeletingView] = useState(false);
  const activeView =
    schema.views.find((view) => view.id === activeViewId) ?? schema.views[0];
  const title = databaseDisplayTitle(detail, schema);
  const activeSort = activeView?.sort ?? null;
  const allProperties = databaseViewProperties(schema.properties);
  const viewProperties = resolveViewProperties(
    schema.properties,
    activeView?.properties,
  );
  const hostPage = findWorkspacePageById(schema.id);
  const icon = databaseDisplayIcon(schema, hostPage?.icon);
  const inline = variant === "inline";
  const pendingPropertiesRef = useRef<{
    viewId: string;
    properties: DatabaseViewProperty[];
  } | null>(null);
  const propertiesPersistTimerRef = useRef<number | null>(null);
  const databaseIdRef = useRef(schema.id);
  databaseIdRef.current = schema.id;

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

  useEffect(() => {
    return () => {
      if (propertiesPersistTimerRef.current != null) {
        window.clearTimeout(propertiesPersistTimerRef.current);
      }
    };
  }, []);

  const selectView = (id: string) => {
    if (id === activeViewId) return;
    setActiveViewId(id);
    setStoredDatabaseViewId(schema.id, id);
  };

  const handleNew = async (templateId?: string) => {
    if (creating) return;
    setCreating(true);
    try {
      const page = await createDatabaseRow(schema.id, undefined, templateId);
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

  const applyDatabaseDetail = (nextDetail: WorkspaceDatabaseDetail) => {
    const nextSchema = parseDatabaseSchema(nextDetail.json);
    if (!nextSchema) {
      throw new Error("Invalid database.json");
    }
    setDetail(nextDetail);
    setSchema(nextSchema);
    return nextSchema;
  };

  const handleCreateTemplate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const result = await createDatabaseTemplate(schema.id);
      applyDatabaseDetail(result.database);
      openWorkspacePage(result.page, { focusTitle: true });
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to create database template",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleEditTemplate = async (template: DatabaseRowTemplate) => {
    try {
      const detail = await fetchDatabaseTemplate(schema.id, template.id);
      if (detail) {
        openWorkspacePage(detail, { focusTitle: true });
        return;
      }
    } catch (error) {
      console.error(error);
    }
    openWorkspacePage(
      {
        id: template.id,
        slug: null,
        title: template.name,
        icon: template.icon ?? null,
        path: `databases/${schema.id}/templates/${template.id}`,
        hasChildren: false,
        databaseId: schema.id,
      },
      { focusTitle: true },
    );
  };

  const handleDuplicateTemplate = async (templateId: string) => {
    try {
      const result = await duplicateDatabaseTemplate(schema.id, templateId);
      applyDatabaseDetail(result.database);
      openWorkspacePage(result.page, { focusTitle: true });
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to duplicate template",
      );
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const nextDetail = await deleteDatabaseTemplate(schema.id, templateId);
      applyDatabaseDetail(nextDetail);
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error ? error.message : "Failed to delete template",
      );
    }
  };

  const handleSetDefaultTemplate = async (templateId: string) => {
    try {
      const nextDetail = await setDefaultDatabaseTemplate(
        schema.id,
        templateId,
      );
      applyDatabaseDetail(nextDetail);
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to set default template",
      );
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
      applyDatabaseDetail(nextDetail);
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

  const applyLayout = async (layout: DatabaseViewLayout) => {
    if (!activeView || savingView) return;
    if (activeView.layout === layout) return;
    await applyViewUpdate({ layout });
  };

  const flushPropertiesPersist = async () => {
    const pending = pendingPropertiesRef.current;
    if (!pending) return;
    pendingPropertiesRef.current = null;
    try {
      const nextDetail = await updateDatabaseView(
        databaseIdRef.current,
        pending.viewId,
        { properties: pending.properties },
      );
      // A newer edit may have queued while we were saving.
      if (pendingPropertiesRef.current) return;
      const nextSchema = parseDatabaseSchema(nextDetail.json);
      if (!nextSchema) {
        throw new Error("Invalid database.json");
      }
      setDetail(nextDetail);
      setSchema(nextSchema);
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error ? error.message : "Failed to update view",
      );
    }
  };

  const applyProperties = (properties: DatabaseViewProperty[]) => {
    if (!activeView) return;
    const viewId = activeView.id;

    // Optimistic local update — keep the editor snappy.
    setSchema((prev) => ({
      ...prev,
      views: prev.views.map((view) =>
        view.id === viewId ? { ...view, properties } : view,
      ),
    }));

    pendingPropertiesRef.current = { viewId, properties };
    if (propertiesPersistTimerRef.current != null) {
      window.clearTimeout(propertiesPersistTimerRef.current);
    }
    propertiesPersistTimerRef.current = window.setTimeout(() => {
      propertiesPersistTimerRef.current = null;
      void flushPropertiesPersist();
    }, 200);
  };

  const applyCreatedView = (
    nextDetail: WorkspaceDatabaseDetail,
    viewId: string,
  ) => {
    const nextSchema = parseDatabaseSchema(nextDetail.json);
    if (!nextSchema) {
      throw new Error("Invalid database.json");
    }
    setDetail(nextDetail);
    setSchema(nextSchema);
    setActiveViewId(viewId);
    setStoredDatabaseViewId(schema.id, viewId);
  };

  const createView = async () => {
    if (!activeView || savingView) return;
    setSavingView(true);
    try {
      const result = await createDatabaseView(schema.id, {
        layout: activeView.layout,
        copyFromViewId: activeView.id,
      });
      applyCreatedView(result.database, result.viewId);
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error ? error.message : "Failed to create view",
      );
    } finally {
      setSavingView(false);
    }
  };

  const requestDeleteView = () => {
    if (!activeView || savingView || deletingView) return;
    if (schema.views.length <= 1) return;
    setDeleteConfirm({ id: activeView.id, name: activeView.name });
  };

  const confirmDeleteView = async () => {
    if (!deleteConfirm || deletingView) return;

    const deletedId = deleteConfirm.id;
    const fallback =
      schema.views.find((view) => view.id !== deletedId)?.id ?? "";
    setDeletingView(true);
    try {
      const nextDetail = await deleteDatabaseView(schema.id, deletedId);
      const nextSchema = parseDatabaseSchema(nextDetail.json);
      if (!nextSchema) {
        throw new Error("Invalid database.json");
      }
      setDetail(nextDetail);
      setSchema(nextSchema);
      const nextViewId = resolveDatabaseViewId(nextSchema.views, fallback);
      setActiveViewId(nextViewId);
      setStoredDatabaseViewId(schema.id, nextViewId);
      setDeleteConfirm(null);
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error ? error.message : "Failed to delete view",
      );
    } finally {
      setDeletingView(false);
    }
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
          sortProperties={allProperties}
          schemaProperties={schema.properties}
          templates={schema.templates}
          defaultTemplateId={schema.defaultTemplateId}
          view={activeView}
          viewCount={schema.views.length}
          sort={activeSort}
          onSortChange={(next) => void applySort(next)}
          onNameChange={(name) => applyName(name)}
          onLayoutChange={(layout) => void applyLayout(layout)}
          onPropertiesChange={(properties) => void applyProperties(properties)}
          onCreateView={() => void createView()}
          onDeleteView={requestDeleteView}
          onNew={() => void handleNew()}
          onNewFromTemplate={(templateId) => void handleNew(templateId)}
          onCreateTemplate={() => void handleCreateTemplate()}
          onEditTemplate={(template) => void handleEditTemplate(template)}
          onDuplicateTemplate={(templateId) =>
            void handleDuplicateTemplate(templateId)
          }
          onDeleteTemplate={(templateId) =>
            void handleDeleteTemplate(templateId)
          }
          onSetDefaultTemplate={(templateId) =>
            void handleSetDefaultTemplate(templateId)
          }
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
      <ConfirmDialog
        open={deleteConfirm != null}
        onOpenChange={(open) => {
          if (!open && !deletingView) setDeleteConfirm(null);
        }}
        title="Delete view?"
        description={
          deleteConfirm
            ? `“${deleteConfirm.name}” will be removed from this database. Rows stay intact — only this view layout is deleted.`
            : ""
        }
        confirmLabel="Delete view"
        cancelLabel="Cancel"
        confirming={deletingView}
        onConfirm={confirmDeleteView}
      />
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
  const activeView =
    views.find((view) => view.id === activeViewId) ?? views[0];
  const ActiveIcon =
    activeView?.layout === "list" ? PiListBullets : PiTable;

  if (views.length <= 1) {
    if (!activeView) return null;
    return (
      <div
        className="flex min-w-0 flex-wrap items-center gap-1.5"
        role="tablist"
        aria-label="Database views"
      >
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium",
            "bg-app-border/70 text-app-fg",
          )}
        >
          <ActiveIcon className="size-[0.95em] shrink-0" aria-hidden />
          <span>{activeView.name}</span>
        </span>
      </div>
    );
  }

  return (
    <>
      <div
        className="hidden min-w-0 flex-wrap items-center gap-1.5 md:flex"
        role="tablist"
        aria-label="Database views"
      >
        {views.map((view) => {
          const selected = view.id === activeViewId;
          const Icon = view.layout === "list" ? PiListBullets : PiTable;
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
      <Select.Root value={activeViewId} onValueChange={onSelect}>
        <Select.Trigger
          className={cn(
            "inline-flex max-w-full min-w-0 items-center gap-1 rounded-full bg-app-border/70 px-2.5 py-1 text-[0.8125rem] font-medium text-app-fg outline-none md:hidden",
            "hover:bg-app-border/80",
          )}
          aria-label="Database views"
        >
          {activeView ? (
            <>
              <ActiveIcon className="size-[0.95em] shrink-0" aria-hidden />
              <Select.Value className="min-w-0 truncate">
                {activeView.name}
              </Select.Value>
            </>
          ) : (
            <Select.Value placeholder="View" />
          )}
          <Select.Icon className="shrink-0 text-app-fg-muted">
            <PiCaretDown className="size-3" aria-hidden />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            className={cn(
              "z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-app-border bg-app-bg text-app-fg shadow-lg",
            )}
            position="popper"
            sideOffset={6}
            align="start"
          >
            <Select.Viewport className="p-1">
              {views.map((view) => {
                const Icon = view.layout === "list" ? PiListBullets : PiTable;
                return (
                  <Select.Item
                    key={view.id}
                    value={view.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.8125rem] outline-none",
                      "data-[highlighted]:bg-app-border/45",
                      "data-[state=checked]:bg-app-border/70",
                    )}
                  >
                    <Icon className="size-[0.95em] shrink-0" aria-hidden />
                    <Select.ItemText>{view.name}</Select.ItemText>
                  </Select.Item>
                );
              })}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </>
  );
}

function DatabaseViewControls({
  creating,
  savingView,
  sortProperties,
  schemaProperties,
  templates,
  defaultTemplateId,
  view,
  viewCount,
  sort,
  onSortChange,
  onNameChange,
  onLayoutChange,
  onPropertiesChange,
  onCreateView,
  onDeleteView,
  onNew,
  onNewFromTemplate,
  onCreateTemplate,
  onEditTemplate,
  onDuplicateTemplate,
  onDeleteTemplate,
  onSetDefaultTemplate,
  className,
}: {
  creating: boolean;
  savingView: boolean;
  sortProperties: DatabasePropertyColumn[];
  schemaProperties: DatabasePropertyColumn[];
  templates: DatabaseRowTemplate[];
  defaultTemplateId: string;
  view: DatabaseView | undefined;
  viewCount: number;
  sort: DatabaseViewSort | null;
  onSortChange: (sort: DatabaseViewSort | null) => void;
  onNameChange: (name: string) => Promise<boolean>;
  onLayoutChange: (layout: DatabaseViewLayout) => void;
  onPropertiesChange: (properties: DatabaseViewProperty[]) => void;
  onCreateView: () => void;
  onDeleteView: () => void;
  onNew: () => void;
  onNewFromTemplate: (templateId: string) => void;
  onCreateTemplate: () => void;
  onEditTemplate: (template: DatabaseRowTemplate) => void;
  onDuplicateTemplate: (templateId: string) => void;
  onDeleteTemplate: (templateId: string) => void;
  onSetDefaultTemplate: (templateId: string) => void;
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
        properties={sortProperties}
        sort={sort}
        disabled={savingView || sortProperties.length === 0}
        onSortChange={onSortChange}
        triggerClassName={controlBtnClass}
      />
      <DatabaseSettingsPopover
        view={view}
        schemaProperties={schemaProperties}
        viewCount={viewCount}
        disabled={!view}
        saving={savingView}
        onNameChange={onNameChange}
        onLayoutChange={onLayoutChange}
        onPropertiesChange={onPropertiesChange}
        onCreateView={onCreateView}
        onDeleteView={onDeleteView}
        triggerClassName={controlBtnClass}
      />
      <DatabaseNewRowSplitButton
        creating={creating}
        templates={templates}
        defaultTemplateId={defaultTemplateId}
        onNew={onNew}
        onNewFromTemplate={onNewFromTemplate}
        onCreateTemplate={onCreateTemplate}
        onEditTemplate={onEditTemplate}
        onDuplicateTemplate={onDuplicateTemplate}
        onDeleteTemplate={onDeleteTemplate}
        onSetDefaultTemplate={onSetDefaultTemplate}
      />
    </div>
  );
}

const templateMenuItemClass = cn(
  "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[0.8125rem] text-app-fg",
  "hover:bg-app-border/45",
);

function DatabaseNewRowSplitButton({
  creating,
  templates,
  defaultTemplateId,
  onNew,
  onNewFromTemplate,
  onCreateTemplate,
  onEditTemplate,
  onDuplicateTemplate,
  onDeleteTemplate,
  onSetDefaultTemplate,
}: {
  creating: boolean;
  templates: DatabaseRowTemplate[];
  defaultTemplateId: string;
  onNew: () => void;
  onNewFromTemplate: (templateId: string) => void;
  onCreateTemplate: () => void;
  onEditTemplate: (template: DatabaseRowTemplate) => void;
  onDuplicateTemplate: (templateId: string) => void;
  onDeleteTemplate: (templateId: string) => void;
  onSetDefaultTemplate: (templateId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [actionsForId, setActionsForId] = useState<string | null>(null);

  const entries: Array<{
    id: string;
    name: string;
    icon?: string | null;
    locked: boolean;
  }> = [
    {
      id: EMPTY_DATABASE_TEMPLATE_ID,
      name: "Empty",
      locked: true,
    },
    ...templates.map((template) => ({
      id: template.id,
      name: template.name.trim() || "Untitled",
      icon: template.icon,
      locked: false,
    })),
  ];

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setActionsForId(null);
      }}
    >
      <div className="inline-flex overflow-hidden rounded-md bg-blue-600 shadow-sm">
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center px-1.5 py-1 text-white",
            "md:gap-1 md:px-3 md:py-1.5 md:text-[0.8125rem] md:font-semibold",
            "hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70",
          )}
          onClick={onNew}
          disabled={creating}
          aria-label={creating ? "Creating" : "New"}
        >
          <PiPlus className="size-3.5 shrink-0 md:size-[1.05rem]" aria-hidden />
          <span className="hidden md:inline">
            {creating ? "Creating…" : "New"}
          </span>
        </button>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center border-l border-blue-500/80 px-1 text-white",
              "md:px-1.5",
              "hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70",
            )}
            aria-label="Choose template"
            disabled={creating}
          >
            <PiCaretDown className="size-3 md:size-3.5" aria-hidden />
          </button>
        </Popover.Trigger>
      </div>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className={cn(
            "z-50 w-64 rounded-lg border border-app-border bg-app-bg p-1 shadow-lg",
            "outline-none",
          )}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <div className="px-2.5 py-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-app-fg-muted">
            Templates
          </div>
          <div role="menu" className="flex flex-col">
            {entries.map((entry) => {
              const isDefault = entry.id === defaultTemplateId;
              const custom = templates.find(
                (template) => template.id === entry.id,
              );
              return (
                <div key={entry.id} className="relative">
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      role="menuitem"
                      className={cn(templateMenuItemClass, "min-w-0 flex-1")}
                      onClick={() => {
                        setOpen(false);
                        onNewFromTemplate(entry.id);
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {entry.name}
                      </span>
                      {isDefault ? (
                        <span className="shrink-0 text-[0.7rem] text-app-fg-muted">
                          Default
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-app-fg-muted",
                        "hover:bg-app-border/45 hover:text-app-fg",
                      )}
                      aria-label={`${entry.name} template actions`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setActionsForId((current) =>
                          current === entry.id ? null : entry.id,
                        );
                      }}
                    >
                      <PiDotsThree className="size-4" aria-hidden />
                    </button>
                  </div>
                  {actionsForId === entry.id ? (
                    <div
                      role="menu"
                      className={cn(
                        "absolute right-0 top-full z-10 mt-0.5 w-44 rounded-md border border-app-border",
                        "bg-app-bg py-1 shadow-md",
                      )}
                    >
                      {!entry.locked && custom ? (
                        <button
                          type="button"
                          role="menuitem"
                          className={templateMenuItemClass}
                          onClick={() => {
                            setOpen(false);
                            setActionsForId(null);
                            onEditTemplate(custom);
                          }}
                        >
                          <PiPencilSimple className="size-3.5 shrink-0" aria-hidden />
                          Edit
                        </button>
                      ) : null}
                      <button
                        type="button"
                        role="menuitem"
                        className={templateMenuItemClass}
                        onClick={() => {
                          setOpen(false);
                          setActionsForId(null);
                          onDuplicateTemplate(entry.id);
                        }}
                      >
                        <PiCopy className="size-3.5 shrink-0" aria-hidden />
                        Duplicate
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className={templateMenuItemClass}
                        disabled={isDefault}
                        onClick={() => {
                          setOpen(false);
                          setActionsForId(null);
                          onSetDefaultTemplate(entry.id);
                        }}
                      >
                        {isDefault ? (
                          <PiCheck className="size-3.5 shrink-0" aria-hidden />
                        ) : (
                          <PiStar className="size-3.5 shrink-0" aria-hidden />
                        )}
                        Set as default
                      </button>
                      {!entry.locked ? (
                        <button
                          type="button"
                          role="menuitem"
                          className={cn(
                            templateMenuItemClass,
                            "text-red-600 dark:text-red-400",
                          )}
                          onClick={() => {
                            setOpen(false);
                            setActionsForId(null);
                            onDeleteTemplate(entry.id);
                          }}
                        >
                          <PiTrash className="size-3.5 shrink-0" aria-hidden />
                          Delete
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="my-1 h-px bg-app-border" role="separator" />
          <button
            type="button"
            role="menuitem"
            className={templateMenuItemClass}
            onClick={() => {
              setOpen(false);
              onCreateTemplate();
            }}
          >
            <PiPlus className="size-3.5 shrink-0" aria-hidden />
            New template
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

type SettingsPage = "main" | "layout" | "properties";

function DatabaseSettingsPopover({
  view,
  schemaProperties,
  viewCount,
  disabled,
  saving: savingRemote,
  onNameChange,
  onLayoutChange,
  onPropertiesChange,
  onCreateView,
  onDeleteView,
  triggerClassName,
}: {
  view: DatabaseView | undefined;
  schemaProperties: DatabasePropertyColumn[];
  viewCount: number;
  disabled: boolean;
  saving: boolean;
  onNameChange: (name: string) => Promise<boolean>;
  onLayoutChange: (layout: DatabaseViewLayout) => void;
  onPropertiesChange: (properties: DatabaseViewProperty[]) => void;
  onCreateView: () => void;
  onDeleteView: () => void;
  triggerClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<SettingsPage>("main");
  const [draftName, setDraftName] = useState(view?.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const nameBusy = savingName || savingRemote;
  const canDelete = viewCount > 1;
  const visiblePropertyCount = resolveViewProperties(
    schemaProperties,
    view?.properties,
  ).length;
  const layoutLabel = view?.layout === "list" ? "List" : "Table";

  useEffect(() => {
    if (open) {
      setDraftName(view?.name ?? "");
      setPage("main");
    }
  }, [open, view?.name]);

  const commitName = async () => {
    if (!view) return;
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === view.name || nameBusy || disabled) {
      setDraftName(view.name);
      return;
    }
    setSavingName(true);
    try {
      const ok = await onNameChange(trimmed);
      if (!ok) setDraftName(view.name);
    } finally {
      setSavingName(false);
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            triggerClassName,
            open && "bg-app-border/45 text-app-fg",
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
            "z-50 rounded-lg border border-app-border bg-app-surface p-3",
            "shadow-lg outline-none",
            page === "properties" ? "w-72" : "w-64",
          )}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          {page === "main" && view ? (
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-app-fg">View settings</h3>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-app-fg-muted">
                  Name
                </span>
                <input
                  type="text"
                  value={draftName}
                  disabled={nameBusy || disabled}
                  onChange={(event) => setDraftName(event.target.value)}
                  onBlur={() => void commitName()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void commitName();
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setDraftName(view.name);
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
              <div className="space-y-0.5 pt-1">
                <SettingsNavRow
                  label="Layout"
                  value={layoutLabel}
                  onClick={() => setPage("layout")}
                />
                <SettingsNavRow
                  label="Properties"
                  value={String(visiblePropertyCount)}
                  onClick={() => setPage("properties")}
                />
              </div>
              <div className="space-y-0.5 border-t border-app-border pt-2">
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                    "text-app-fg hover:bg-app-border/45",
                    "disabled:cursor-not-allowed disabled:opacity-45",
                  )}
                  disabled={disabled || savingRemote}
                  onClick={() => {
                    onCreateView();
                    setOpen(false);
                  }}
                >
                  <PiPlus className="size-3.5 shrink-0" aria-hidden />
                  <span className="font-medium">New view</span>
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                    canDelete
                      ? "text-red-600 hover:bg-red-500/10 dark:text-red-400"
                      : "text-app-fg-muted",
                    "disabled:cursor-not-allowed disabled:opacity-45",
                  )}
                  disabled={disabled || savingRemote || !canDelete}
                  title={
                    canDelete
                      ? "Delete this view"
                      : "At least one view is required"
                  }
                  onClick={() => {
                    onDeleteView();
                    setOpen(false);
                  }}
                >
                  <PiTrash className="size-3.5 shrink-0" aria-hidden />
                  <span className="font-medium">Delete view</span>
                </button>
              </div>
            </section>
          ) : null}

          {page === "layout" && view ? (
            <SettingsSubpage
              title="Layout"
              onBack={() => setPage("main")}
            >
              <div className="space-y-0.5">
                <SettingsChoiceRow
                  label="Table"
                  icon={<PiTable className="size-4 shrink-0" aria-hidden />}
                  selected={view.layout === "table"}
                  disabled={disabled || savingRemote}
                  onClick={() => onLayoutChange("table")}
                />
                <SettingsChoiceRow
                  label="List"
                  icon={
                    <PiListBullets className="size-4 shrink-0" aria-hidden />
                  }
                  selected={view.layout === "list"}
                  disabled={disabled || savingRemote}
                  onClick={() => onLayoutChange("list")}
                />
              </div>
            </SettingsSubpage>
          ) : null}

          {page === "properties" && view ? (
            <SettingsSubpage
              title="Properties"
              onBack={() => setPage("main")}
            >
              <ViewPropertiesEditor
                schemaProperties={schemaProperties}
                stored={view.properties}
                disabled={disabled}
                onChange={onPropertiesChange}
              />
            </SettingsSubpage>
          ) : null}

          <Popover.Arrow className="fill-app-surface" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function SettingsSubpage({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-md",
            "text-app-fg-muted hover:bg-app-border/45 hover:text-app-fg",
          )}
          aria-label="Back"
          onClick={onBack}
        >
          <PiArrowLeft className="size-4" aria-hidden />
        </button>
        <h3 className="text-sm font-medium text-app-fg">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function SettingsNavRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
        "text-app-fg hover:bg-app-border/45",
      )}
      onClick={onClick}
    >
      <span className="min-w-0 flex-1 font-medium">{label}</span>
      {value ? (
        <span className="shrink-0 text-xs text-app-fg-muted">{value}</span>
      ) : null}
      <PiCaretRight
        className="size-3.5 shrink-0 text-app-fg-muted"
        aria-hidden
      />
    </button>
  );
}

function SettingsChoiceRow({
  label,
  icon,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
        selected
          ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
          : "text-app-fg hover:bg-app-border/45",
        "disabled:opacity-60",
      )}
      onClick={onClick}
    >
      {icon}
      <span className="min-w-0 flex-1 font-medium">{label}</span>
    </button>
  );
}

type PropertySectionId = "shown" | "hidden";

function packViewProperties(
  shownIds: string[],
  hiddenIds: string[],
  titleId: string | null = null,
): DatabaseViewProperty[] {
  return pinTitlePropertyFirst(
    [
      ...shownIds.map((id) => ({ id, visible: true as const })),
      ...hiddenIds.map((id) => ({ id, visible: false as const })),
    ],
    titleId,
  );
}

function ViewPropertiesEditor({
  schemaProperties,
  stored,
  disabled,
  onChange,
}: {
  schemaProperties: DatabasePropertyColumn[];
  stored: DatabaseViewProperty[] | null | undefined;
  disabled: boolean;
  onChange: (properties: DatabaseViewProperty[]) => void;
}) {
  const [entries, setEntries] = useState(() =>
    resolveViewPropertyEntries(schemaProperties, stored),
  );
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overlayPos, setOverlayPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const overlayOffsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setEntries(resolveViewPropertyEntries(schemaProperties, stored));
  }, [schemaProperties, stored]);

  useEffect(() => {
    if (activeId == null) {
      setOverlayPos(null);
      return;
    }
    const onMove = (event: PointerEvent) => {
      setOverlayPos({
        x: event.clientX - overlayOffsetRef.current.x,
        y: event.clientY - overlayOffsetRef.current.y,
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [activeId]);

  const byId = new Map(
    databaseViewProperties(schemaProperties).map((property) => [
      property.id,
      property,
    ]),
  );
  const titleId =
    databaseViewProperties(schemaProperties).find(
      (property) => property.type === "title",
    )?.id ?? null;

  const shownIds = entries.filter((e) => e.visible).map((e) => e.id);
  const hiddenIds = entries.filter((e) => !e.visible).map((e) => e.id);
  const activeProperty = activeId
    ? (byId.get(String(activeId)) ?? null)
    : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const toggleVisibility = (propertyId: string) => {
    if (disabled) return;
    if (titleId !== null && propertyId === titleId) return;

    const prev = entriesRef.current;
    const shown = prev.filter((e) => e.visible).map((e) => e.id);
    const hidden = prev.filter((e) => !e.visible).map((e) => e.id);
    const inShown = shown.includes(propertyId);
    if (inShown) {
      const next = packViewProperties(
        shown.filter((id) => id !== propertyId),
        [...hidden, propertyId],
        titleId,
      );
      setEntries(next);
      onChange(next);
      return;
    }
    const next = packViewProperties(
      [...shown, propertyId],
      hidden.filter((id) => id !== propertyId),
      titleId,
    );
    setEntries(next);
    onChange(next);
  };

  const sectionOf = (
    id: UniqueIdentifier,
    shown: string[],
    hidden: string[],
  ): PropertySectionId | null => {
    const key = String(id);
    if (key === "shown" || shown.includes(key)) return "shown";
    if (key === "hidden" || hidden.includes(key)) return "hidden";
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (titleId !== null && String(event.active.id) === titleId) return;

    setActiveId(event.active.id);
    const activator = event.activatorEvent;
    const rect = event.active.rect.current.initial;
    const clientX =
      activator instanceof PointerEvent || activator instanceof MouseEvent
        ? activator.clientX
        : activator instanceof TouchEvent
          ? activator.touches[0]?.clientX
          : undefined;
    const clientY =
      activator instanceof PointerEvent || activator instanceof MouseEvent
        ? activator.clientY
        : activator instanceof TouchEvent
          ? activator.touches[0]?.clientY
          : undefined;
    if (rect && clientX != null && clientY != null) {
      overlayOffsetRef.current = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
      setOverlayPos({ x: rect.left, y: rect.top });
    } else if (rect) {
      overlayOffsetRef.current = { x: 12, y: 12 };
      setOverlayPos({ x: rect.left, y: rect.top });
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || disabled) return;

    const activeKey = String(active.id);
    if (titleId !== null && activeKey === titleId) return;

    setEntries((prev) => {
      const shown = prev.filter((e) => e.visible).map((e) => e.id);
      const hidden = prev.filter((e) => !e.visible).map((e) => e.id);
      const from = sectionOf(active.id, shown, hidden);
      const to = sectionOf(over.id, shown, hidden);
      if (!from || !to || from === to) return prev;

      const fromList = from === "shown" ? shown : hidden;
      const toList = to === "shown" ? shown : hidden;
      const fromIndex = fromList.indexOf(activeKey);
      if (fromIndex < 0) return prev;

      fromList.splice(fromIndex, 1);
      const overKey = String(over.id);
      let insertAt = toList.length;
      if (overKey !== "shown" && overKey !== "hidden") {
        const idx = toList.indexOf(overKey);
        if (idx >= 0) insertAt = idx;
      }
      // Never insert above the locked title in Shown.
      if (to === "shown" && titleId !== null) {
        const titleIndex = toList.indexOf(titleId);
        if (titleIndex >= 0) {
          insertAt = Math.max(insertAt, titleIndex + 1);
        }
      }
      toList.splice(insertAt, 0, activeKey);

      return packViewProperties(
        from === "shown" ? fromList : toList,
        from === "shown" ? toList : fromList,
        titleId,
      );
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverlayPos(null);
    if (!over || disabled) {
      setEntries(resolveViewPropertyEntries(schemaProperties, stored));
      return;
    }

    const activeKey = String(active.id);
    if (titleId !== null && activeKey === titleId) {
      setEntries(resolveViewPropertyEntries(schemaProperties, stored));
      return;
    }

    const prev = entriesRef.current;
    const shown = prev.filter((e) => e.visible).map((e) => e.id);
    const hidden = prev.filter((e) => !e.visible).map((e) => e.id);
    const overKey = String(over.id);

    const section = sectionOf(active.id, shown, hidden);
    if (!section) {
      onChange(pinTitlePropertyFirst(prev, titleId));
      return;
    }

    const list = section === "shown" ? [...shown] : [...hidden];
    const other = section === "shown" ? hidden : shown;
    const oldIndex = list.indexOf(activeKey);
    if (oldIndex < 0) {
      onChange(pinTitlePropertyFirst(prev, titleId));
      return;
    }

    let newIndex = list.indexOf(overKey);
    if (overKey === "shown" || overKey === "hidden") {
      newIndex = list.length - 1;
    }
    if (newIndex < 0) {
      // Dropped on the other section — dragOver already updated lists
      const next = packViewProperties(shown, hidden, titleId);
      setEntries(next);
      onChange(next);
      return;
    }

    if (section === "shown" && titleId !== null) {
      const titleIndex = list.indexOf(titleId);
      if (titleIndex >= 0 && newIndex <= titleIndex) {
        newIndex = titleIndex + 1;
      }
      if (newIndex >= list.length) newIndex = list.length - 1;
    }

    const moved = arrayMove(list, oldIndex, newIndex);
    const next =
      section === "shown"
        ? packViewProperties(moved, other, titleId)
        : packViewProperties(other, moved, titleId);
    setEntries(next);
    onChange(next);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setOverlayPos(null);
        setEntries(resolveViewPropertyEntries(schemaProperties, stored));
      }}
    >
      <PropertySection
        id="shown"
        title="Shown"
        ids={shownIds}
        byId={byId}
        titleId={titleId}
        disabled={disabled}
        onToggleVisibility={toggleVisibility}
      />
      <PropertySection
        id="hidden"
        title="Hidden"
        ids={hiddenIds}
        byId={byId}
        titleId={titleId}
        disabled={disabled}
        onToggleVisibility={toggleVisibility}
        className="mt-2"
      />
      {activeProperty && overlayPos
        ? createPortal(
            <div
              className="pointer-events-none fixed z-200"
              style={{ left: overlayPos.x, top: overlayPos.y }}
            >
              <PropertyRowContent
                property={activeProperty}
                visible
                dragging
              />
            </div>,
            document.body,
          )
        : null}
    </DndContext>
  );
}

function PropertySection({
  id,
  title,
  ids,
  byId,
  titleId,
  disabled,
  onToggleVisibility,
  className,
}: {
  id: PropertySectionId;
  title: string;
  ids: string[];
  byId: Map<string, DatabasePropertyColumn>;
  titleId: string | null;
  disabled: boolean;
  onToggleVisibility: (propertyId: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-1 px-1 text-[0.7rem] font-semibold tracking-wide text-app-fg-muted uppercase">
        {title}
      </div>
      <SortableContext
        items={ids}
        strategy={verticalListSortingStrategy}
        disabled={disabled}
      >
        <PropertySectionList id={id} empty={ids.length === 0}>
          {ids.length === 0 ? (
            <li className="px-1 text-xs text-app-fg-muted">None</li>
          ) : (
            ids.map((propertyId) => {
              const property = byId.get(propertyId);
              if (!property) return null;
              const visible = id === "shown";
              const locked = titleId !== null && propertyId === titleId;
              return (
                <SortablePropertyRow
                  key={propertyId}
                  property={property}
                  visible={visible}
                  canHide={!locked}
                  locked={locked}
                  disabled={disabled}
                  onToggleVisibility={() => onToggleVisibility(propertyId)}
                />
              );
            })
          )}
        </PropertySectionList>
      </SortableContext>
    </div>
  );
}

function PropertySectionList({
  id,
  empty,
  children,
}: {
  id: PropertySectionId;
  empty: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <ul
      ref={setNodeRef}
      className={cn(
        "min-h-8 space-y-0.5 rounded-md",
        empty && "border border-dashed border-app-border/70 p-2",
        isOver && "bg-app-border/25",
      )}
      data-section={id}
    >
      {children}
    </ul>
  );
}

function SortablePropertyRow({
  property,
  visible,
  canHide,
  locked,
  disabled,
  onToggleVisibility,
}: {
  property: DatabasePropertyColumn;
  visible: boolean;
  canHide: boolean;
  locked: boolean;
  disabled: boolean;
  onToggleVisibility: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: property.id, disabled: disabled || locked });

  return (
    <li
      ref={setNodeRef}
      style={{
        // Keep layout animations for siblings; the active row is hidden and
        // shown via the pointer portal (Radix popover transform breaks it).
        transform: isDragging ? undefined : CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(isDragging && "opacity-0")}
    >
      <PropertyRowContent
        property={property}
        visible={visible}
        canHide={canHide}
        locked={locked}
        disabled={disabled}
        onToggleVisibility={onToggleVisibility}
        handleProps={locked ? undefined : { ...attributes, ...listeners }}
      />
    </li>
  );
}

function PropertyRowContent({
  property,
  visible = true,
  canHide = true,
  locked = false,
  disabled,
  onToggleVisibility,
  handleProps,
  dragging,
}: {
  property: DatabasePropertyColumn;
  visible?: boolean;
  canHide?: boolean;
  locked?: boolean;
  disabled?: boolean;
  onToggleVisibility?: () => void;
  handleProps?: Record<string, unknown>;
  dragging?: boolean;
}) {
  const TypeIcon = databasePropertyTypeIcon(property.type);
  const EyeIcon = visible ? PiEye : PiEyeSlash;
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-app-fg",
        dragging && "border border-app-border bg-app-surface shadow-md",
        !dragging && "hover:bg-app-border/35",
      )}
    >
      {locked ? (
        <span
          className="inline-flex size-6 shrink-0 items-center justify-center text-app-fg-muted/45"
          aria-hidden
          title="Name is always first"
        >
          <PiDotsSixVertical className="size-3.5" />
        </span>
      ) : (
        <button
          type="button"
          className={cn(
            "inline-flex size-6 cursor-grab items-center justify-center rounded",
            "text-app-fg-muted active:cursor-grabbing",
            "touch-none",
          )}
          aria-label={`Reorder ${property.name}`}
          {...handleProps}
        >
          <PiDotsSixVertical className="size-3.5" aria-hidden />
        </button>
      )}
      <TypeIcon className="size-3.5 shrink-0 text-app-fg-muted" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{property.name}</span>
      {onToggleVisibility ? (
        <button
          type="button"
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded",
            "text-app-fg-muted hover:bg-app-border/55 hover:text-app-fg",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
          aria-label={
            visible ? `Hide ${property.name}` : `Show ${property.name}`
          }
          title={
            !canHide
              ? "Name cannot be hidden"
              : visible
                ? "Hide"
                : "Show"
          }
          disabled={disabled || !canHide}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleVisibility();
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <EyeIcon className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
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

  if (view.layout === "list") {
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
