export type WorkspaceInfo = {
  id: string;
  slug: string;
  title: string;
  icon?: string;
  description?: string;
  createdAt: string;
  version: number;
}

export enum ConnectionType {
  remote = "remote",
  local = "local",
}

export type WorkspaceConnection = {
  type: ConnectionType;
  git?: string;
  url?: string;
  directory?: string;
  cachedInfo: WorkspaceInfo;
}

export type ConnectionState = (ConnectionStatePeding | ConnectionStateSuccess | ConnectionStateError) & {
  checking?: boolean;
}
type ConnectionStatePeding = {
  success?: undefined;
}
type ConnectionStateSuccess = {
  success: true;
}
type ConnectionStateError = {
  success: false;
  error: string;
}

export type Workspace = {
  info: WorkspaceInfo;
  connection: WorkspaceConnection;
  connectionState: ConnectionState;


  // TODO
  toc?: any;
  pages?: any;
}

export type AddLocalRepoResponse = {
  ok: boolean;
  error?: string;
  workspace?: WorkspaceInfo;
}

export type CreateWorkspaceRequest = {
  slug: string;
  title: string;
  icon?: string;
  description?: string;
}

export type Page = {
  id: string;
  parentId?: string;
  title: string;
  slug: string;
  cover?: string;
  icon?: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
}

export type PageWithContent = {
  page: Page;
  content: string;
}

export type TOCItem = {
  id: string;
  parentId?: string;
  title: string;
  slug: string;
  icon?: string;
  /** Intentionally made optional to indicate not loaded. */
  children?: TOCItem[];
}

export type Database = {
  id: string;
  title: string;
  cover?: string;
  icon?: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
}