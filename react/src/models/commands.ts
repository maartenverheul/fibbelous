// Command & CommandResult TypeScript definitions extracted from ServerContext
// Keep in sync with Rust enums in lib/command_handler.rs

export type Command =
  | { type: 'ping', payload?: {} }
  | { type: 'get_saved_workspaces', payload?: {} }
  | { type: 'get_saved_connections', payload?: {} }
  | { type: 'read_page'; payload: { pageId: string } }
  | { type: 'create_new_page'; payload?: { parent?: string } }
  | { type: 'get_toc'; payload?: { parent?: string } };

export type CommandResult =
  | { kind: 'pong' }
  | { kind: 'workspaces'; workspaces: any[] }
  | { kind: 'connections'; connections: any[] }
  | { kind: 'page'; page: any }
  | { kind: 'toc'; toc: any[] }
  | { kind: 'pageWithContent'; page: any; content: string }
  | { kind: 'void' }
  | { kind: 'error'; error: string };
