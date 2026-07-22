/** Shared Tailwind classes for database UI (React + BlockNote DOM). */

export const dbRoot =
  "my-2 w-full overflow-hidden bg-transparent select-none";

export const dbRootPage =
  "my-0 w-full overflow-hidden bg-transparent select-none";

export const dbEmptyShell =
  "rounded-md bg-[color-mix(in_srgb,var(--app-border)_18%,var(--app-surface))]";

export const dbMutedText = "py-3.5 text-sm text-[var(--app-fg-muted)]";

export const dbScroll = "w-full overflow-x-auto overflow-y-hidden";

export const dbTable =
  "w-full min-w-max border-collapse table-auto border border-[var(--app-border)]";

export const dbTh =
  "min-w-32 border border-[var(--app-border)] px-2 py-1.5 text-left align-middle text-xs font-semibold whitespace-nowrap text-[var(--app-fg-muted)]";

export const dbTd =
  "border border-[var(--app-border)] px-2 py-1.5 text-left align-middle whitespace-nowrap";

export const dbThTitle = "min-w-48";

export const dbTdTitle = "min-w-48";

export const dbTableRow = "group";

export const dbTitleCell = "flex min-w-0 items-center gap-2";

export const dbTitleCellText = "min-w-0 flex-1 truncate";

export const dbOpenBtn =
  "shrink-0 rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-0.5 text-xs font-medium text-[var(--app-fg-muted)] opacity-0 transition-opacity hover:bg-[color-mix(in_srgb,var(--app-border)_45%,transparent)] hover:text-[var(--app-fg)] group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100";

export const dbColName = "block leading-snug";

export const dbCellEmpty =
  "py-5 text-center text-sm whitespace-normal text-[var(--app-fg-muted)]";

export const dbListItems = "m-0 list-none p-0";

export const dbListItem = "m-0";

export const dbListItemButton =
  "flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-2.5 py-[0.45rem] text-left text-[0.9375rem] text-[var(--app-fg)] hover:bg-[color-mix(in_srgb,var(--app-border)_45%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color-mix(in_srgb,var(--app-fg)_35%,transparent)]";

export const dbListItemTitle = "min-w-0 shrink truncate font-medium";

export const dbListItemAttrs =
  "flex min-w-0 flex-1 items-center gap-3 overflow-hidden text-sm font-normal text-[var(--app-fg-muted)]";

export const dbListItemAttr = "min-w-0 shrink truncate";

export const dbCheckbox =
  "pointer-events-none size-3.5 shrink-0 rounded-sm border border-[color-mix(in_srgb,var(--app-fg)_35%,transparent)] accent-blue-600";

export const dbSentinel = "h-px w-full";
