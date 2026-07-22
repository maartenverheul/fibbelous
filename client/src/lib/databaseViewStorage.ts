const STORAGE_KEY_PREFIX = "fibbelous:database-view:";

export function getStoredDatabaseViewId(databaseId: string): string | null {
  if (!databaseId) return null;
  try {
    const value = localStorage.getItem(`${STORAGE_KEY_PREFIX}${databaseId}`);
    return value?.trim() || null;
  } catch {
    return null;
  }
}

export function setStoredDatabaseViewId(
  databaseId: string,
  viewId: string,
): void {
  if (!databaseId || !viewId.trim()) return;
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${databaseId}`, viewId.trim());
  } catch {
    // Ignore quota / private mode failures.
  }
}
