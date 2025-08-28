export type WorkspaceInfo = {
  id: string,
  slug: string,
  title: string,
  icon?: string,
  description?: string,
  created_at?: string,
}

export type AddLocalRepoResponse = {
  ok: boolean,
  error?: string,
  workspace?: WorkspaceInfo,
}

export type Page = {
  id: string;
  title: string;
  cover?: string;
  icon?: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
}


export type Database = {
  id: string;
  title: string;
  cover?: string;
  icon?: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
}