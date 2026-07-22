import {
  dbSelectChip,
  dbSelectChipGroup,
  resolveSelectTokens,
  selectOptionStyles,
} from "../../lib/databaseSelect";
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
          className={dbSelectChip}
          style={selectOptionStyles(token.color)}
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
  return type === "select" || type === "multi_select";
}
