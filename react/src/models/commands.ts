// Command & CommandResult TypeScript definitions extracted from ServerContext
// Keep in sync with Rust enums in lib/command_handler.rs

import { AddLocalRepoResponse, CreateWorkspaceRequest, Page, PageWithContent, TOCItem, WorkspaceConnection, WorkspaceInfo } from ".";

type TOCUpdateAction = 'add' | 'remove' | 'update';

export type UpdatePageCommand = {
  pageId: string;
  title?: string;
  content?: string;
  icon?: string;
}

export type CommandList = {
  addLocalRespository: { payload: { path: string, existing?: boolean }, returnType: AddLocalRepoResponse }
  createNewPage: { payload?: { parent?: string }, returnType: Page }
  deletePage: { payload: { pageId: string }, returnType: boolean }
  editWorkspace: { payload: { workspace: CreateWorkspaceRequest }, returnType: void }
  getSavedConnections: { payload?: {}, returnType: WorkspaceConnection[] }
  getSavedWorkspaces: { payload?: {}, returnType: WorkspaceInfo[] }
  getToc: { payload?: { parent?: string, depth?: number }, returnType: { toc: TOCItem[] } }
  ping: { payload?: {}, returnType: { kind: 'pong' } }
  readPage: { payload: { pageId: string }, returnType: PageWithContent }
  removeSavedWorkspace: { payload: { id: string }, returnType: boolean }
  updatePage: { payload: UpdatePageCommand, returnType: Page }
};

export type EventList = {
  tocUpdated: {
    id: string,
    item?: TOCItem;
    action: TOCUpdateAction;
  }
}

export type CommandResult =
  | { kind: 'pong' }
  | { kind: 'workspaces'; workspaces: any[] }
  | { kind: 'connections'; connections: any[] }
  | { kind: 'page'; page: any }
  | { kind: 'toc'; toc: any[] }
  | { kind: 'pageWithContent'; page: any; content: string }
  | { kind: 'void' }
  | { kind: 'error'; error: string };
