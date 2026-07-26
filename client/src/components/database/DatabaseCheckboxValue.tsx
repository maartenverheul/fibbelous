import { dbCheckbox } from "../../lib/database/ui";
import type { DatabasePropertyColumn } from "../../lib/database/types";

export function isCheckboxPropertyType(
  type: DatabasePropertyColumn["type"],
): boolean {
  return type === "checkbox";
}

export function isCheckboxChecked(value: unknown): boolean {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true" ||
    value === "yes"
  );
}

/** Read-only checkbox replacing Yes/No text for boolean properties. */
export function DatabaseCheckboxValue({ value }: { value: unknown }) {
  const checked = isCheckboxChecked(value);
  return (
    <input
      type="checkbox"
      className={dbCheckbox}
      checked={checked}
      readOnly
      tabIndex={-1}
      aria-checked={checked}
      aria-label={checked ? "Checked" : "Unchecked"}
    />
  );
}
