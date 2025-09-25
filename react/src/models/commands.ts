// Command & CommandResult TypeScript definitions extracted from ServerContext
// Keep in sync with Rust enums in lib/command_handler.rs

import { CreateWorkspaceRequest, Page, PageWithContent, TOCItem } from ".";

type TOCUpdateAction = 'add' | 'remove' | 'update';

export type UpdatePageCommand = {
  pageId: string;
  title?: string;
  content?: string;
  icon?: string;
}

export type CommandList = {
  createNewPage: { payload?: { parent?: string }, returnType: Page }
  deletePage: { payload: { pageId: string }, returnType: { kind: 'pong' } }
  editWorkspace: { payload: { workspace: CreateWorkspaceRequest }, returnType: void }
  getSavedConnections: { payload?: {}, returnType: { kind: 'pong' } }
  getSavedWorkspaces: { payload?: {}, returnType: { kind: 'pong' } }
  getToc: { payload?: { parent?: string, depth?: number }, returnType: { toc: TOCItem[] } }
  ping: { payload?: {}, returnType: { kind: 'pong' } }
  readPage: { payload: { pageId: string }, returnType: PageWithContent }
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
