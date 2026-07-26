export type IndexStatus = "pending" | "indexing" | "ready" | "failed";

export type WorkspaceInfo = {
  id: string;
  slug: string;
  title: string;
  icon: string;
  createdAt: string;
  indexStatus: IndexStatus;
};

export type CreateWorkspaceInput = {
  title: string;
  slug?: string;
  icon?: string;
};

export type UpdateWorkspaceInput = {
  title?: string;
  slug?: string;
  icon?: string;
};

export type SavedWorkspace = {
  id: string;
  label: string;
  /** HTTP(S) origin of the remote server, e.g. `https://example.com` or `http://127.0.0.1:8080`. */
  serverUrl: string;
  workspaceId: string;
  slug: string;
  icon?: string;
  /** Absolute folder path when this bookmark is a Tauri local workspace. */
  localPath?: string;
};

export function isLocalWorkspace(
  workspace: Pick<SavedWorkspace, "localPath">,
): boolean {
  return Boolean(workspace.localPath);
}

export type WorkspaceConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";
