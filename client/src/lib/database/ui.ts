/** Shared Tailwind classes for database UI (React + BlockNote DOM). */

export const dbRoot =
  "my-2 w-full overflow-hidden bg-transparent select-none";

/** Inline embed chrome: rounded border + padding. */
export const dbRootInline =
  "my-2 w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-app-border bg-transparent p-3 select-none";

export const dbRootPage =
  "my-0 w-full overflow-hidden bg-transparent select-none";

export const dbEmptyShell =
  "rounded-md bg-app-border/18";

export const dbMutedText = "py-3.5 text-sm text-app-fg-muted";

export const dbScroll = "w-full overflow-x-auto overflow-y-hidden";

/** Inline embed: capped height with both-axis scroll. */
export const dbScrollInline =
  "app-scroll w-full min-w-0 max-w-full max-h-80 overflow-auto overscroll-contain";

export const dbTable =
  "w-full min-w-max border-collapse table-auto border border-app-border";

export const dbTh =
  "min-w-32 border border-app-border px-2 py-1.5 text-left align-middle text-xs font-semibold whitespace-nowrap text-app-fg-muted";

export const dbTd =
  "border border-app-border px-2 py-1.5 text-left align-middle whitespace-nowrap";

export const dbThTitle = "min-w-48";

export const dbTdTitle = "min-w-48";

export const dbTableRow = "group";

export const dbTitleCell = "flex min-w-0 items-center gap-2";

export const dbTitleCellText = "min-w-0 flex-1 truncate";

export const dbOpenBtn =
  "shrink-0 rounded-md border border-app-border bg-app-surface px-2 py-0.5 text-xs font-medium text-app-fg-muted opacity-0 transition-opacity hover:bg-app-border/45 hover:text-app-fg group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100";

export const dbColName = "block leading-snug";

export const dbCellEmpty =
  "py-5 text-center text-sm whitespace-normal text-app-fg-muted";

export const dbListItems = "m-0 list-none p-0";

export const dbListItem = "m-0";

export const dbListItemButton =
  "flex min-w-0 w-full cursor-pointer items-center gap-2 overflow-hidden rounded-md border-0 bg-transparent px-2.5 py-[0.45rem] text-left text-[0.9375rem] text-app-fg hover:bg-app-border/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-app-fg/35";

export const dbListItemTitle = "shrink-0 whitespace-nowrap font-medium";

export const dbListItemAttrs =
  "flex min-w-0 flex-1 items-center gap-3 overflow-hidden text-sm font-normal text-app-fg-muted";

export const dbListItemAttr = "shrink-0 whitespace-nowrap";

export const dbCheckbox = "app-checkbox pointer-events-none size-3.5 shrink-0";

export const dbSentinel = "h-px w-full";
