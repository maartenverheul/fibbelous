export type WorkspaceInfo = {
  id: string;
  slug: string;
  title: string;
  icon?: string;
  description?: string;
  createdAt?: string;
}

export type WorkspaceConnection = {
  url: string;

  info?: WorkspaceInfo;
}

export type AddLocalRepoResponse = {
  ok: boolean;
  error?: string;
  workspace?: WorkspaceInfo;
}

export type Page = {
  id: string;
  parentId?: string;
  title: string;
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