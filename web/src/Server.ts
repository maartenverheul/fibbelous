import type { AppRouter, Workspace } from "@fibbelous/server/lib";
import {
  createTRPCClient,
  createTRPCProxyClient,
  createWSClient,
  httpBatchLink,
  loggerLink,
  wsLink,
} from "@trpc/client";

const logger = loggerLink({
  enabled: (opts) =>
    (process.env.NODE_ENV === "development" && typeof window !== "undefined") ||
    (opts.direction === "down" && opts.result instanceof Error),
});

export class Server {
  trpc: ReturnType<typeof createTRPCProxyClient<AppRouter>> = null!;

  private wsClient: ReturnType<typeof createWSClient> | null = null;

  private constructor(public readonly url: string) {}

  public static async connect(url: string): Promise<Server> {
    const server = new Server(url);
    await server._connect();
    return server;
  }

  private _connect() {
    return new Promise<void>((resolve, reject) => {
      const trpcUrl = this.url + "/trpc";
      // const httpLink = httpBatchLink({
      //   // url: "http://localhost:3000/trpc",
      //   url: trpcUrl,
      // });

      this.wsClient = createWSClient({
        url: "ws://localhost:3000",
      });

      this.trpc = createTRPCProxyClient<AppRouter>({
        links: [logger, wsLink<AppRouter>({ client: this.wsClient })],
      });

      // TODO test connection
      fetch(trpcUrl)
        .then(() => resolve())
        .catch((err) => reject(new Error("Could not connect to server")));
    });
  }

  public disconnect() {
    this.wsClient?.close();
  }

  public getWorkspaces(): Promise<Workspace[]> {
    return this.trpc!.getWorkspaces.query();
  }
}
