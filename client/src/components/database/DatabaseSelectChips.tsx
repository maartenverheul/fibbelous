import {
  dbSelectChip,
  dbSelectChipGroup,
  resolveSelectTokens,
} from "../../lib/databaseSelect";
import { cn } from "../../lib/utils";
import type { DatabasePropertyColumn } from "../../types/database";

export function DatabaseSelectChips({
  value,
  options,
}: {
  value: unknown;
  options?: DatabasePropertyColumn["options"];
}) {
  const tokens = resolveSelectTokens(value, options);
  if (tokens.length === 0) return null;

  return (
    <span className={dbSelectChipGroup}>
      {tokens.map((token) => (
        <span
          key={`${token.name}:${token.color}`}
          className={cn(dbSelectChip, `bg-select-${token.color}`)}
          title={token.name}
        >
          {token.name}
        </span>
      ))}
    </span>
  );
}

export function isSelectPropertyType(
  type: DatabasePropertyColumn["type"],
): boolean {
  return type === "select" || type === "multi_select" || type === "status";
}
