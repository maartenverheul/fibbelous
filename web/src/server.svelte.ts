import type { AppRouter, Page } from "@fibbelous/server/lib";
import { createTRPCProxyClient, httpBatchLink, loggerLink } from "@trpc/client";
import { Server } from "./Server";

export enum SyncStatus {
  Idle = "idle",
  Loading = "loading",
  Saving = "saving",
  Error = "error",
}

export class ServerStore {
  pages: Page[] = $state([]);
  workspaces: Page[] = $state([]);
  activePage: Page | null = $state(null);
  syncStatus: SyncStatus = $state(SyncStatus.Idle);

  trpc: ReturnType<typeof createTRPCProxyClient<AppRouter>> | null = null;

  connect(url: string): Promise<Server> {
    return Server.connect(url);
  }

  async init() {
    if (!this.trpc) throw new Error("Not connected to server");
    this.pages = await this.trpc.workspace.pages.list.query();
  }
}

const serverStore = new ServerStore();
export default serverStore;
