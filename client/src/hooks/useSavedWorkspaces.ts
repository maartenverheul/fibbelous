import { useCallback } from "react";
import useLocalStorageState from "use-local-storage-state";
import type { SavedWorkspace } from "../types/workspace";

const WORKSPACES_KEY = "fibbelous.workspaces";
const ACTIVE_WORKSPACE_KEY = "fibbelous.activeWorkspaceId";

export function useSavedWorkspaces() {
  const [workspaces, setWorkspaces] = useLocalStorageState<SavedWorkspace[]>(
    WORKSPACES_KEY,
    { defaultValue: [] },
  );
  const [activeWorkspaceId, setActiveWorkspaceId] = useLocalStorageState<
    string | null
  >(ACTIVE_WORKSPACE_KEY, { defaultValue: null });

  const addWorkspace = useCallback(
    (workspace: SavedWorkspace) => {
      setWorkspaces((prev) => {
        const exists = prev.some((item) => {
          if (workspace.localPath || item.localPath) {
            return (
              Boolean(workspace.localPath) &&
              item.localPath === workspace.localPath
            );
          }
          return (
            item.serverHost === workspace.serverHost &&
            item.serverPort === workspace.serverPort &&
            item.workspaceId === workspace.workspaceId
          );
        });
        if (exists) return prev;
        return [...prev, workspace];
      });
    },
    [setWorkspaces],
  );

  const updateWorkspace = useCallback(
    (id: string, patch: Partial<Omit<SavedWorkspace, "id">>) => {
      setWorkspaces((prev) =>
        prev.map((workspace) =>
          workspace.id === id ? { ...workspace, ...patch } : workspace,
        ),
      );
    },
    [setWorkspaces],
  );

  const removeWorkspace = useCallback(
    (id: string) => {
      setWorkspaces((prev) => prev.filter((workspace) => workspace.id !== id));
      setActiveWorkspaceId((current) => (current === id ? null : current));
    },
    [setWorkspaces, setActiveWorkspaceId],
  );

  const setActive = useCallback(
    (id: string | null) => {
      setActiveWorkspaceId(id);
    },
    [setActiveWorkspaceId],
  );

  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;

  const findBySlug = useCallback(
    (slug: string) => workspaces.find((workspace) => workspace.slug === slug),
    [workspaces],
  );

  const isBookmarked = useCallback(
    (host: string, port: number, workspaceId: string) =>
      workspaces.some(
        (item) =>
          item.serverHost === host &&
          item.serverPort === port &&
          item.workspaceId === workspaceId,
      ),
    [workspaces],
  );

  return {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    addWorkspace,
    updateWorkspace,
    removeWorkspace,
    setActive,
    findBySlug,
    isBookmarked,
  };
}
