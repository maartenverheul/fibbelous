import type { Change } from "textdiff-patch";

type Void = void | Promise<void>;

export interface ClientCommandHandler {
  listPages(): Void;
  createPage(name: string): Void;
  deletePage(id: string): Void;
  loadPage(id: string): Void;
  editPage(id: string, diff: Change[]): Void;
}

export interface ServerCommandHandler {
  listPages(data: string[]): Void;
  pageCreated(id: string): Void;
  pageDeleted(id: string): Void;
  pageUpdated(id: string, content: string): Void;
  pageLoaded(id: string, content: string): Void;
}
