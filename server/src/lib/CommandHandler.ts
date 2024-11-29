type Void = void | Promise<void>;

export interface ClientCommandHandler {
  listPages(): Void;
  createPage(name: string): Void;
  deletePage(id: string): Void;
  loadPage(id: string): Void;
}

export interface ServerCommandHandler {
  listPages(data: string[]): Void;
  pageCreated(id: string): Void;
  pageDeleted(id: string): Void;
  pageLoaded(content: string): Void;
}
