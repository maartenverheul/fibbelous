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