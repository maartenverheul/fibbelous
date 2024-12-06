import type {
  AppRouter,
  LoadedPage,
  Page,
  Workspace,
} from "@fibbelous/server/lib";
import {
  createTRPCProxyClient,
  createWSClient,
  loggerLink,
  wsLink,
} from "@trpc/client";

export enum SyncStatus {
  Idle = "idle",
  Loading = "loading",
  Saving = "saving",
  Error = "error",
}

const logger = loggerLink({
  enabled: (opts) =>
    (process.env.NODE_ENV === "development" && typeof window !== "undefined") ||
    (opts.direction === "down" && opts.result instanceof Error),
});

export class ServerStore {
  connected = $state(false);
  workspaces: Page[] = $state([]);
  activePage: LoadedPage | null = $state(null);
  syncStatus: SyncStatus = $state(SyncStatus.Idle);
  trpc: ReturnType<typeof createTRPCProxyClient<AppRouter>> = null!;

  private wsClient: ReturnType<typeof createWSClient> | null = null;

  public async connect(url: string): Promise<void> {
    if (this.wsClient) this.disconnect();

    const trpcUrl = url + "/trpc";

    this.wsClient = createWSClient({
      url: "ws://localhost:3000",
      onOpen: () => {
        this.connected = true;
      },
      onClose: (cause) => {
        this.connected = false;
      },
    });

    this.trpc = createTRPCProxyClient<AppRouter>({
      links: [logger, wsLink<AppRouter>({ client: this.wsClient })],
    });

    // Test connection
    try {
      fetch(trpcUrl);
    } catch (e) {
      throw new Error("Could not connect to server");
    }
  }

  public disconnect() {
    if (!this.wsClient) return;
    this.wsClient.close();
  }

  public getWorkspaces(): Promise<Workspace[]> {
    return this.trpc!.getWorkspaces.query();
  }
}

const serverStore = new ServerStore();
export default serverStore;
