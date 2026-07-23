import type { SelectOption } from "../types/database";

export type SelectToken = {
  name: string;
  color: string;
};

/** Notion-like select option palette (dark chips + contrasting text). */
const SELECT_COLOR_STYLES: Record<string, { background: string; foreground: string }> = {
  default: { background: "#454441", foreground: "#ffffff" },
  gray: { background: "#454441", foreground: "#ffffff" },
  brown: { background: "#64473a", foreground: "#ffffff" },
  orange: { background: "#9a5b14", foreground: "#ffffff" },
  yellow: { background: "#89632a", foreground: "#ffffff" },
  green: { background: "#2b593f", foreground: "#ffffff" },
  blue: { background: "#284b63", foreground: "#ffffff" },
  purple: { background: "#492f64", foreground: "#ffffff" },
  pink: { background: "#69314c", foreground: "#ffffff" },
  red: { background: "#6e3630", foreground: "#ffffff" },
};

export function selectOptionStyles(color: string | null | undefined): {
  backgroundColor: string;
  color: string;
} {
  const key = (color ?? "default").trim().toLowerCase();
  const palette = SELECT_COLOR_STYLES[key] ?? SELECT_COLOR_STYLES.default;
  return {
    backgroundColor: palette.background,
    color: palette.foreground,
  };
}

/** Shared chip classes for select / multi_select tokens. */
export const dbSelectChip =
  "inline-flex max-w-full items-center truncate rounded-md px-2 py-0.5 text-xs font-medium leading-snug";

export const dbSelectChipGroup = "inline-flex max-w-full flex-wrap items-center gap-1";

function optionName(raw: unknown): string | null {
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.name === "string" && record.name.trim()) {
    return record.name.trim();
  }
  return null;
}

function optionColorHint(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  return typeof record.color === "string" ? record.color : null;
}

export function resolveSelectTokens(
  value: unknown,
  options: SelectOption[] | undefined,
): SelectToken[] {
  const rawItems = Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
  const tokens: SelectToken[] = [];

  for (const item of rawItems) {
    const name = optionName(item);
    if (!name) continue;

    const fromSchema = options?.find(
      (option) =>
        option.name === name ||
        option.id === name ||
        option.name.toLowerCase() === name.toLowerCase(),
    );
    tokens.push({
      name: fromSchema?.name ?? name,
      color: fromSchema?.color ?? optionColorHint(item) ?? "default",
    });
  }

  return tokens;
}
