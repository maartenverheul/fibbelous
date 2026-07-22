import {
  MDX_PLACEHOLDER_TAG_RE,
  idAttrFromMdxRaw,
  mdxRawWithAttrs,
} from "./mdxPlaceholders";
import {
  dbSelectChip,
  dbSelectChipGroup,
  resolveSelectTokens,
  selectOptionStyles,
} from "./databaseSelect";
import { fetchDatabaseRows, createDatabaseRow } from "./databaseFetch";
import {
  getStoredDatabaseViewId,
  setStoredDatabaseViewId,
} from "./databaseViewStorage";
import { openWorkspacePage } from "./pageNavigate";
import {
  dbCellEmpty,
  dbColName,
  dbEmptyShell,
  dbListItem,
  dbListItemAttr,
  dbListItemAttrs,
  dbListItemButton,
  dbListItemTitle,
  dbListItems,
  dbMutedText,
  dbCheckbox,
  dbRoot,
  dbScroll,
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
} from "./databaseUi";
import { getScrollParent, isInVerticalScrollport, cn } from "./utils";
import {
  databaseDisplayTitle,
  pageFromDatabaseRow,
  parseDatabaseSchema,
  type DatabasePropertyColumn,
  type DatabaseRowSummary,
  type DatabaseSchema,
  type DatabaseView,
  type WorkspaceDatabaseDetail,
} from "../types/database";
import { pageLabel } from "../types/page";

const ROW_PAGE_SIZE = 50;

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
  const withoutTags = trimmed.replace(
    MDX_PLACEHOLDER_TAG_RE,
    (_match, tag: string) => {
      if (tag.toLowerCase() === "database") {
        databaseCount += 1;
      } else {
        otherTagCount += 1;
      }
      return "";
    },
  );

  if (databaseCount !== 1 || otherTagCount > 0) return false;
  return withoutTags.trim() === "";
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

/** Build the table UI from schema + cached rows. */
export function paintDatabaseTable(
  dom: HTMLElement,
  detail: WorkspaceDatabaseDetail,
): { destroy?: () => void } {
  const schema = parseDatabaseSchema(detail.json);
  const title = databaseDisplayTitle(detail, schema);

  dom.replaceChildren();
  dom.className = dbRoot;
  dom.title = detail.path;

  if (!schema) {
    const empty = document.createElement("div");
    empty.className = dbMutedText;
    empty.textContent = "Invalid database.json";
    dom.appendChild(empty);
    return {};
  }

  dom.dataset.databaseId = schema.id;

  const bodyHost = document.createElement("div");

  let activeViewId = resolveDatabaseViewId(
    schema.views,
    getStoredDatabaseViewId(schema.id),
  );
  let destroyBody: (() => void) | undefined;

  const renderActive = () => {
    destroyBody?.();
    destroyBody = undefined;
    const activeView =
      schema.views.find((view) => view.id === activeViewId) ?? schema.views[0];
    bodyHost.replaceChildren();

    if (!activeView || schema.properties.length === 0) {
      const empty = document.createElement("div");
      empty.className = dbMutedText;
      empty.textContent =
        schema.properties.length === 0
          ? "No properties defined"
          : "No view selected";
      bodyHost.appendChild(empty);
      return;
    }

    const painted = renderViewBody(
      schema.id,
      activeView,
      schema.properties,
      title,
    );
    bodyHost.appendChild(painted.dom);
    destroyBody = painted.destroy;
  };

  const tabs = renderViewTabs(schema.views, () => activeViewId, (id) => {
    if (id === activeViewId) return;
    activeViewId = id;
    setStoredDatabaseViewId(schema.id, id);
    for (const tab of tabs.querySelectorAll<HTMLButtonElement>("[data-view-id]")) {
      const selected = tab.dataset.viewId === activeViewId;
      tab.className = selected ? VIEW_TAB_ACTIVE : VIEW_TAB_IDLE;
      tab.setAttribute("aria-selected", selected ? "true" : "false");
    }
    renderActive();
  });

  const toolbar = document.createElement("div");
  toolbar.className =
    "mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2";
  toolbar.appendChild(tabs);
  const controls = renderViewControls(schema.id);
  toolbar.appendChild(controls.dom);

  dom.appendChild(toolbar);
  dom.appendChild(bodyHost);
  renderActive();

  return {
    destroy: () => {
      destroyBody?.();
      controls.destroy();
    },
  };
}

const VIEW_TAB_IDLE =
  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium bg-[color-mix(in_srgb,var(--app-border)_35%,transparent)] text-[var(--app-fg-muted)] hover:bg-[color-mix(in_srgb,var(--app-border)_55%,transparent)] hover:text-[var(--app-fg)]";

const VIEW_TAB_ACTIVE =
  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium bg-[color-mix(in_srgb,var(--app-border)_70%,transparent)] text-[var(--app-fg)]";

const CONTROL_BTN =
  "inline-flex size-8 items-center justify-center rounded-md text-[var(--app-fg-muted)] hover:bg-[color-mix(in_srgb,var(--app-border)_45%,transparent)] hover:text-[var(--app-fg)] disabled:cursor-not-allowed disabled:opacity-45";

const NEW_BTN =
  "inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-[0.8125rem] font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70";

function renderViewControls(databaseId: string): {
  dom: HTMLElement;
  destroy: () => void;
} {
  const controls = document.createElement("div");
  controls.className = "ml-auto flex flex-wrap items-center gap-1.5";

  const filter = document.createElement("button");
  filter.type = "button";
  filter.className = CONTROL_BTN;
  filter.setAttribute("aria-label", "Filter");
  filter.title = "Filter (coming soon)";
  filter.disabled = true;
  filter.innerHTML = FUNNEL_ICON_SVG;
  controls.appendChild(filter);

  const sort = document.createElement("button");
  sort.type = "button";
  sort.className = CONTROL_BTN;
  sort.setAttribute("aria-label", "Sort");
  sort.title = "Sort (coming soon)";
  sort.disabled = true;
  sort.innerHTML = SORT_ICON_SVG;
  controls.appendChild(sort);

  const settingsWrap = document.createElement("div");
  settingsWrap.className = "relative";
  const settingsBtn = document.createElement("button");
  settingsBtn.type = "button";
  settingsBtn.className = CONTROL_BTN;
  settingsBtn.setAttribute("aria-label", "View settings");
  settingsBtn.title = "View settings";
  settingsBtn.setAttribute("aria-expanded", "false");
  settingsBtn.innerHTML = GEAR_ICON_SVG;

  const popover = document.createElement("div");
  popover.className = cn(
    "absolute top-full right-0 z-50 mt-1.5 hidden w-56 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3 shadow-lg",
  );
  popover.setAttribute("role", "dialog");
  popover.innerHTML =
    `<p class="text-sm font-medium text-stone-900 dark:text-stone-50">View settings</p>` +
    `<p class="mt-1 text-xs text-stone-600 dark:text-stone-400">Coming soon</p>`;

  const setOpen = (open: boolean) => {
    popover.classList.toggle("hidden", !open);
    settingsBtn.setAttribute("aria-expanded", open ? "true" : "false");
  };

  settingsBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(popover.classList.contains("hidden"));
  });

  const onDocClick = (event: MouseEvent) => {
    if (!settingsWrap.contains(event.target as Node)) {
      setOpen(false);
    }
  };
  document.addEventListener("click", onDocClick);

  settingsWrap.appendChild(settingsBtn);
  settingsWrap.appendChild(popover);
  controls.appendChild(settingsWrap);

  const newBtn = document.createElement("button");
  newBtn.type = "button";
  newBtn.className = NEW_BTN;
  newBtn.innerHTML = `${PLUS_ICON_SVG}<span>New</span>`;
  newBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (newBtn.disabled) return;
    newBtn.disabled = true;
    const label = newBtn.querySelector("span");
    if (label) label.textContent = "Creating…";
    void (async () => {
      try {
        const page = await createDatabaseRow(databaseId);
        openWorkspacePage(page);
      } catch (error) {
        console.error(error);
        alert(
          error instanceof Error
            ? error.message
            : "Failed to create database row",
        );
      } finally {
        newBtn.disabled = false;
        if (label) label.textContent = "New";
      }
    })();
  });
  controls.appendChild(newBtn);

  return {
    dom: controls,
    destroy: () => {
      document.removeEventListener("click", onDocClick);
    },
  };
}

const FUNNEL_ICON_SVG = `<svg class="size-[1.05rem] shrink-0" viewBox="0 0 256 256" fill="currentColor" width="1em" height="1em" aria-hidden="true"><path d="M200 40H56a16 16 0 0 0-16 16v16a15.9 15.9 0 0 0 4.7 11.3L96 140.7V216a8 8 0 0 0 12.4 6.7l32-21.3a8 8 0 0 0 3.6-6.7v-54.4l51.3-57.4A15.9 15.9 0 0 0 200 72V56a16 16 0 0 0-16-16Zm0 32-51.3 57.4A15.9 15.9 0 0 0 144 140.7V192l-16 10.7V140.7a15.9 15.9 0 0 0-4.7-11.3L56 56h144Z"/></svg>`;

const SORT_ICON_SVG = `<svg class="size-[1.05rem] shrink-0" viewBox="0 0 256 256" fill="currentColor" width="1em" height="1em" aria-hidden="true"><path d="M119.4 172.9a8 8 0 0 1 1.1 11.2l-32 40a8 8 0 0 1-12.2.1l-32-40a8 8 0 1 1 12.4-10.1L80 198.6l25.5-31.9a8 8 0 0 1 13.9 6.2ZM152 192h48a8 8 0 0 1 0 16h-48a8 8 0 0 1 0-16Zm0-40h48a8 8 0 0 1 0 16h-48a8 8 0 0 1 0-16Zm0-40h48a8 8 0 0 1 0 16h-48a8 8 0 0 1 0-16Zm-71.1-63.1a8 8 0 0 0-1.1 11.2L105.5 92.7 80 124.6l-25.5-31.9a8 8 0 0 0-12.4 10.1l32 40a8 8 0 0 0 12.2.1l32-40a8 8 0 0 0-13.4-10ZM152 72h48a8 8 0 0 0 0-16h-48a8 8 0 0 0 0 16Z"/></svg>`;

const PLUS_ICON_SVG = `<svg class="size-[1.05rem] shrink-0" viewBox="0 0 256 256" fill="currentColor" width="1em" height="1em" aria-hidden="true"><path d="M224 128a8 8 0 0 1-8 8h-80v80a8 8 0 0 1-16 0v-80H40a8 8 0 0 1 0-16h80V40a8 8 0 0 1 16 0v80h80a8 8 0 0 1 8 8Z"/></svg>`;

const GEAR_ICON_SVG = `<svg class="size-[1.05rem] shrink-0" viewBox="0 0 256 256" fill="currentColor" width="1em" height="1em" aria-hidden="true"><path d="M128 80a48 48 0 1 0 48 48 48.05 48.05 0 0 0-48-48Zm0 80a32 32 0 1 1 32-32 32 32 0 0 1-32 32Zm45.12-123.12-5.94 21.41a8 8 0 0 0 4.8 9.61 55.5 55.5 0 0 1 0 99.2 8 8 0 0 0-4.8 9.61l5.94 21.41a8 8 0 0 0 9.8 5.66l21.4-5.94a8 8 0 0 0 5.26-10.05 55.82 55.82 0 0 1 0-114.9 8 8 0 0 0-5.26-10.05l-21.4-5.94a8 8 0 0 0-9.8 5.66ZM55.06 178.34a55.5 55.5 0 0 1 0-99.2 8 8 0 0 0 4.8-9.61L53.92 48.12a8 8 0 0 0-9.8-5.66l-21.4 5.94a8 8 0 0 0-5.26 10.05 55.82 55.82 0 0 0 0 114.9 8 8 0 0 0 5.26 10.05l21.4 5.94a8 8 0 0 0 9.8-5.66l5.94-21.41a8 8 0 0 0-4.8-9.61Z"/></svg>`;

function renderViewTabs(
  views: DatabaseView[],
  getActiveId: () => string,
  onSelect: (id: string) => void,
): HTMLElement {
  const tabs = document.createElement("div");
  tabs.className = "flex min-w-0 flex-wrap items-center gap-1.5";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Database views");

  for (const view of views) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.dataset.viewId = view.id;
    tab.setAttribute("role", "tab");
    const selected = view.id === getActiveId();
    tab.className = selected ? VIEW_TAB_ACTIVE : VIEW_TAB_IDLE;
    tab.setAttribute("aria-selected", selected ? "true" : "false");
    tab.appendChild(createLayoutIcon(view.settings.layout));
    const label = document.createElement("span");
    label.textContent = view.name;
    tab.appendChild(label);
    tab.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onSelect(view.id);
    });
    tabs.appendChild(tab);
  }

  return tabs;
}

function createLayoutIcon(layout: DatabaseView["settings"]["layout"]): HTMLElement {
  const icon = document.createElement("span");
  icon.className = "inline-flex size-[0.95em] shrink-0";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML =
    layout === "list"
      ? `<svg viewBox="0 0 256 256" fill="currentColor" width="100%" height="100%"><path d="M80 64a8 8 0 0 1 8-8h128a8 8 0 0 1 0 16H88a8 8 0 0 1-8-8Zm136 56H88a8 8 0 0 0 0 16h128a8 8 0 0 0 0-16Zm0 64H88a8 8 0 0 0 0 16h128a8 8 0 0 0 0-16ZM44 52a12 12 0 1 0 12 12 12 12 0 0 0-12-12Zm0 64a12 12 0 1 0 12 12 12 12 0 0 0-12-12Zm0 64a12 12 0 1 0 12 12 12 12 0 0 0-12-12Z"/></svg>`
      : `<svg viewBox="0 0 256 256" fill="currentColor" width="100%" height="100%"><path d="M224 48H32a16 16 0 0 0-16 16v128a16 16 0 0 0 16 16h192a16 16 0 0 0 16-16V64a16 16 0 0 0-16-16ZM32 64h56v32H32Zm0 48h56v32H32Zm0 80v-32h56v32Zm192 0H104v-32h120Zm0-48H104v-32h120Zm0-48H104V64h120Z"/></svg>`;
  return icon;
}

function renderViewBody(
  databaseId: string,
  view: DatabaseView,
  properties: DatabasePropertyColumn[],
  title: string,
): { dom: HTMLElement; destroy?: () => void } {
  if (view.settings.layout === "list") {
    const list = document.createElement("div");
    list.setAttribute("aria-label", `${title} · ${view.name}`);
    const status = document.createElement("div");
    status.className = dbMutedText;
    status.textContent = "Loading…";
    list.appendChild(status);

    const items = document.createElement("ul");
    items.className = dbListItems;
    list.appendChild(items);

    const sentinel = document.createElement("div");
    sentinel.className = dbSentinel;
    list.appendChild(sentinel);

    const destroy = mountRowLoader({
      databaseId,
      sentinel,
      onPage: (rows, append) => {
        if (!append) {
          items.replaceChildren();
          status.remove();
        }
        if (rows.length === 0 && !append) {
          status.textContent = "No rows yet";
          list.prepend(status);
          return;
        }
        for (const row of rows) {
          const page = pageFromDatabaseRow(row);
          const item = document.createElement("li");
          item.className = dbListItem;

          const button = document.createElement("button");
          button.type = "button";
          button.className = dbListItemButton;
          button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            openWorkspacePage(page);
          });

          const label = document.createElement("span");
          label.className = dbListItemTitle;
          label.textContent = pageLabel(page);
          button.appendChild(label);

          const attrs = listRowAttributes(row, properties);
          if (attrs.length > 0) {
            const meta = document.createElement("span");
            meta.className = dbListItemAttrs;
            for (const attr of attrs) {
              const value = document.createElement("span");
              value.className = dbListItemAttr;
              if (attr.value) value.title = attr.value;
              appendPropertyValue(value, attr.property, row);
              meta.appendChild(value);
            }
            button.appendChild(meta);
          }

          item.appendChild(button);
          items.appendChild(item);
        }
      },
      onError: (message) => {
        status.textContent = message;
        if (!status.isConnected) list.prepend(status);
      },
    });

    return { dom: list, destroy };
  }

  const scroller = document.createElement("div");
  scroller.className = dbScroll;

  const table = document.createElement("table");
  table.className = dbTable;
  table.setAttribute("role", "table");
  table.setAttribute("aria-label", `${title} · ${view.name}`);

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const property of properties) {
    headRow.appendChild(renderColumnHeader(property));
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  table.appendChild(tbody);
  scroller.appendChild(table);

  const status = document.createElement("div");
  status.className = dbMutedText;
  status.textContent = "Loading…";
  scroller.appendChild(status);

  const sentinel = document.createElement("div");
  sentinel.className = dbSentinel;
  scroller.appendChild(sentinel);

  const destroy = mountRowLoader({
    databaseId,
    sentinel,
    onPage: (rows, append) => {
      if (!append) {
        tbody.replaceChildren();
        status.textContent = "";
      }
      if (rows.length === 0 && !append) {
        tbody.appendChild(renderEmptyBodyRow(properties.length, "No rows yet"));
        return;
      }
      for (const row of rows) {
        tbody.appendChild(renderDataRow(row, properties));
      }
      if (append) {
        status.textContent = "";
      }
    },
    onLoadingMore: () => {
      status.textContent = "Loading more…";
    },
    onError: (message) => {
      if (tbody.childElementCount === 0) {
        tbody.appendChild(renderEmptyBodyRow(properties.length, message));
        status.textContent = "";
      } else {
        status.textContent = message;
      }
    },
  });

  return { dom: scroller, destroy };
}

function mountRowLoader(options: {
  databaseId: string;
  sentinel: Element;
  onPage: (rows: DatabaseRowSummary[], append: boolean) => void;
  onLoadingMore?: () => void;
  onError: (message: string) => void;
}): () => void {
  let offset = 0;
  let hasMore = true;
  let loading = false;
  let cancelled = false;

  const loadMore = async () => {
    if (cancelled || loading || !hasMore) return;
    loading = true;
    if (offset > 0) options.onLoadingMore?.();

    try {
      const page = await fetchDatabaseRows(options.databaseId, {
        limit: ROW_PAGE_SIZE,
        offset,
      });
      if (cancelled) return;

      if (!page) {
        hasMore = false;
        options.onError("Database not found");
        return;
      }

      if (page.rows.length === 0) {
        hasMore = false;
        return;
      }

      options.onPage(page.rows, offset > 0);
      offset += page.rows.length;
      hasMore = page.hasMore;
    } catch (error) {
      if (cancelled) return;
      options.onError(
        error instanceof Error ? error.message : "Failed to load rows",
      );
    } finally {
      loading = false;
      // Fill the scrollport, then stop until the user scrolls the sentinel in.
      if (!cancelled && hasMore && isInVerticalScrollport(options.sentinel, 120)) {
        void loadMore();
      }
    }
  };

  const root = getScrollParent(options.sentinel);
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadMore();
      }
    },
    { root, rootMargin: "120px" },
  );
  observer.observe(options.sentinel);

  void loadMore();

  return () => {
    cancelled = true;
    observer.disconnect();
  };
}

function renderColumnHeader(
  property: DatabasePropertyColumn,
): HTMLTableCellElement {
  const th = document.createElement("th");
  th.scope = "col";
  th.dataset.propertyId = property.id;
  th.dataset.propertyType = property.type;
  th.className =
    property.type === "title" ? `${dbTh} ${dbThTitle}` : dbTh;

  const name = document.createElement("span");
  name.className = dbColName;
  name.textContent = property.name;
  th.appendChild(name);
  return th;
}

function renderDataRow(
  row: DatabaseRowSummary,
  properties: DatabasePropertyColumn[],
): HTMLTableRowElement {
  const tr = document.createElement("tr");
  tr.className = dbTableRow;
  const page = pageFromDatabaseRow(row);

  for (const property of properties) {
    const td = document.createElement("td");
    td.dataset.propertyType = property.type;
    td.className =
      property.type === "title" ? `${dbTd} ${dbTdTitle}` : dbTd;

    if (property.type === "title") {
      const cell = document.createElement("div");
      cell.className = dbTitleCell;

      const text = document.createElement("span");
      text.className = dbTitleCellText;
      appendPropertyValue(text, property, row);
      cell.appendChild(text);

      const open = document.createElement("button");
      open.type = "button";
      open.className = dbOpenBtn;
      open.textContent = "Open";
      open.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openWorkspacePage(page);
      });
      cell.appendChild(open);

      td.appendChild(cell);
    } else {
      appendPropertyValue(td, property, row);
    }

    tr.appendChild(td);
  }
  return tr;
}

function renderEmptyBodyRow(
  columnCount: number,
  message: string,
): HTMLTableRowElement {
  const row = document.createElement("tr");

  const cell = document.createElement("td");
  cell.colSpan = Math.max(columnCount, 1);
  cell.className = dbCellEmpty;
  cell.textContent = message;
  row.appendChild(cell);
  return row;
}

function listRowAttributes(
  row: DatabaseRowSummary,
  properties: DatabasePropertyColumn[],
): { id: string; value: string; property: DatabasePropertyColumn }[] {
  const attrs: {
    id: string;
    value: string;
    property: DatabasePropertyColumn;
  }[] = [];
  for (const property of properties) {
    if (property.type === "title") continue;
    const raw = rowCellValue(row, property);
    if (property.type === "select" || property.type === "multi_select") {
      if (resolveSelectTokens(raw, property.options).length === 0) continue;
      attrs.push({ id: property.id, value: "", property });
      continue;
    }
    if (property.type === "checkbox" || typeof raw === "boolean") {
      attrs.push({ id: property.id, value: "", property });
      continue;
    }
    const value = formatCellValue(raw);
    if (!value) continue;
    attrs.push({ id: property.id, value, property });
  }
  return attrs;
}

function appendPropertyValue(
  host: HTMLElement,
  property: DatabasePropertyColumn,
  row: DatabaseRowSummary,
): void {
  const value = rowCellValue(row, property);
  if (property.type === "select" || property.type === "multi_select") {
    const chips = renderSelectChips(value, property.options);
    if (chips) host.appendChild(chips);
    return;
  }
  if (property.type === "checkbox" || typeof value === "boolean") {
    host.appendChild(renderCheckboxValue(value));
    return;
  }
  host.textContent = formatCellValue(value);
}

function renderCheckboxValue(value: unknown): HTMLInputElement {
  const checked =
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true" ||
    value === "yes";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = dbCheckbox;
  input.checked = checked;
  input.readOnly = true;
  input.tabIndex = -1;
  input.setAttribute("aria-checked", checked ? "true" : "false");
  input.setAttribute("aria-label", checked ? "Checked" : "Unchecked");
  input.addEventListener("click", (event) => {
    event.preventDefault();
  });
  return input;
}

function renderSelectChips(
  value: unknown,
  options: DatabasePropertyColumn["options"],
): HTMLElement | null {
  const tokens = resolveSelectTokens(value, options);
  if (tokens.length === 0) return null;

  const group = document.createElement("span");
  group.className = dbSelectChipGroup;
  for (const token of tokens) {
    const chip = document.createElement("span");
    chip.className = dbSelectChip;
    chip.textContent = token.name;
    chip.title = token.name;
    Object.assign(chip.style, selectOptionStyles(token.color));
    group.appendChild(chip);
  }
  return group;
}

function rowCellValue(
  row: DatabaseRowSummary,
  property: DatabasePropertyColumn,
): unknown {
  if (property.type === "title") return row.title;
  const attrs =
    row.attributes && typeof row.attributes === "object"
      ? row.attributes
      : {};
  const byName = attrs[property.name.toLowerCase()];
  if (byName !== undefined) return byName;
  return attrs[property.key.toLowerCase()];
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
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function paintDatabaseError(
  dom: HTMLElement,
  databaseId: string,
  message: string,
): void {
  dom.replaceChildren();
  dom.className = `${dbRoot} ${dbEmptyShell}`;

  const body = document.createElement("div");
  body.className = dbMutedText;
  body.textContent = databaseId
    ? `Database · ${databaseId} — ${message}`
    : message;

  dom.appendChild(body);
}

export type { DatabaseSchema };
