import type { LoadedPage, Page } from "@fibbelous/server/lib";
import { Server } from "./Server";

export enum SyncStatus {
  Idle = "idle",
  Loading = "loading",
  Saving = "saving",
  Error = "error",
}

export class ServerStore {
  currentServer: Server | null = $state(null);
  workspaces: Page[] = $state([]);
  activePage: LoadedPage | null = $state(null);
  syncStatus: SyncStatus = $state(SyncStatus.Idle);

  async connect(url: string): Promise<void> {
    this.currentServer = await Server.connect(url);
  }
}

const serverStore = new ServerStore();
export default serverStore;
