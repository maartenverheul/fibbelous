import type { SavedWorkspace } from "../api/workspace";
import { buildWorkspacePath } from "../../routes";

const STORAGE_KEY = "fibbelous.lastRouteByWorkspaceId";

type LastRouteMap = Record<string, string>;

function readMap(): LastRouteMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: LastRouteMap = {};
    for (const [id, segment] of Object.entries(parsed)) {
      if (typeof segment === "string") out[id] = segment;
    }
    return out;
  } catch {
    return {};
  }
}

function writeMap(map: LastRouteMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore quota / private mode failures.
  }
}

/** Last workspace-relative route segment (`""` = Home, `settings`, page path, …). */
export function getLastRouteSegment(bookmarkId: string): string | null {
  if (!bookmarkId) return null;
  const map = readMap();
  return bookmarkId in map ? map[bookmarkId]! : null;
}

export function setLastRouteSegment(
  bookmarkId: string,
  segment: string,
): void {
  if (!bookmarkId) return;
  const map = readMap();
  map[bookmarkId] = segment;
  writeMap(map);
}

export function clearLastRouteSegment(bookmarkId: string): void {
  if (!bookmarkId) return;
  const map = readMap();
  if (!(bookmarkId in map)) return;
  delete map[bookmarkId];
  writeMap(map);
}

/** Path to reopen a saved workspace at its last segment (Home if none). */
export function buildRestoredWorkspacePath(workspace: SavedWorkspace): string {
  const segment = getLastRouteSegment(workspace.id) ?? "";
  return buildWorkspacePath(workspace.slug, segment);
}
