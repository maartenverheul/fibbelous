import type { AppRouter, Workspace } from "@fibbelous/server/lib";
import { createTRPCProxyClient, httpBatchLink, loggerLink } from "@trpc/client";

const logger = loggerLink({
  enabled: (opts) =>
    (process.env.NODE_ENV === "development" && typeof window !== "undefined") ||
    (opts.direction === "down" && opts.result instanceof Error),
});

export class Server {
  trpc: ReturnType<typeof createTRPCProxyClient<AppRouter>> | null = null;

  private constructor(public readonly url: string) {}

  public static async connect(url: string): Promise<Server> {
    const server = new Server(url);
    await server._connect();
    return server;
  }

  private _connect() {
    return new Promise<void>((resolve, reject) => {
      const trpcUrl = this.url + "/trpc";
      const httpLink = httpBatchLink({
        // url: "http://localhost:3000/trpc",
        url: trpcUrl,
      });

      this.trpc = createTRPCProxyClient<AppRouter>({
        links: [logger, httpLink],
      });

      // TODO test connection
      fetch(trpcUrl)
        .then(() => resolve())
        .catch((err) => reject(new Error("Could not connect to server")));
    });
  }

  public getWorkspaces(): Promise<Workspace[]> {
    return this.trpc!.getWorkspaces.query();
  }
}
