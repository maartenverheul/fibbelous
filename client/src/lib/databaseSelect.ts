import type { SelectOption } from "../types/database";

export type SelectToken = {
  name: string;
  color: string;
};

/** Shared chip classes for select / multi_select tokens. Pair with `bg-select-${color}`. */
export const dbSelectChip =
  "inline-flex max-w-full items-center truncate rounded-md px-2 py-0.5 text-xs font-medium leading-snug text-select-fg";

export const dbSelectChipGroup = "inline-flex max-w-full flex-wrap items-center gap-1";

function optionName(raw: unknown): string | null {
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.name === "string" && record.name.trim()) {
    return record.name.trim();
  }
  if (typeof record.name === "number" && Number.isFinite(record.name)) {
    return String(record.name);
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
      color: (fromSchema?.color ?? optionColorHint(item) ?? "default")
        .trim()
        .toLowerCase(),
    });
  }

  return tokens;
}
