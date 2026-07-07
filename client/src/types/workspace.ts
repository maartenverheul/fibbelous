export type IndexStatus = "pending" | "indexing" | "ready" | "failed";

export type WorkspaceInfo = {
  id: string;
  slug: string;
  name: string;
  icon: string;
  createdAt: string;
  indexStatus: IndexStatus;
};

export type CreateWorkspaceInput = {
  name: string;
  slug?: string;
  icon?: string;
};

export type UpdateWorkspaceInput = {
  name?: string;
  slug?: string;
  icon?: string;
};

export type SavedWorkspace = {
  id: string;
  label: string;
  serverHost: string;
  serverPort: number;
  workspaceId: string;
  slug: string;
  icon?: string;
};

export type WorkspaceConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";
