// Command & CommandResult TypeScript definitions extracted from ServerContext
// Keep in sync with Rust enums in lib/command_handler.rs

import { Page, PageWithContent, TOCItem } from ".";

type TOCUpdateAction = 'add' | 'remove' | 'update';

export type UpdatePageCommand = {
  pageId: string;
  title?: string;
  content?: string;
  icon?: string;
}

export type CommandList = {
  ping: { payload?: {}, returnType: { kind: 'pong' } }
  getSavedWorkspaces: { payload?: {}, returnType: { kind: 'pong' } }
  getSavedConnections: { payload?: {}, returnType: { kind: 'pong' } }
  createNewPage: { payload?: { parent?: string }, returnType: Page }
  getToc: { payload?: { parent?: string }, returnType: { toc: TOCItem[] } }
  readPage: { payload: { pageId: string }, returnType: PageWithContent }
  deletePage: { payload: { pageId: string }, returnType: { kind: 'pong' } }
  updatePage: { payload: UpdatePageCommand, returnType: void }
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
