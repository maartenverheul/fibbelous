import type {
  ServerCommandHandler,
  AppRouter,
  Page,
} from "@fibbelous/server/lib";
import { createTRPCProxyClient, httpBatchLink, loggerLink } from "@trpc/client";

export enum SyncStatus {
  Idle = "idle",
  Loading = "loading",
  Saving = "saving",
  Error = "error",
}

const httpLink = httpBatchLink({
  url: "http://localhost:3000/trpc",
});

const logger = loggerLink({
  enabled: (opts) =>
    (process.env.NODE_ENV === "development" && typeof window !== "undefined") ||
    (opts.direction === "down" && opts.result instanceof Error),
});

const trpc = createTRPCProxyClient<AppRouter>({
  links: [logger, httpLink],
});

export class ServerState {
  pages: Page[] = $state([]);
  activePage: Page | null = $state(null);
  syncStatus: SyncStatus = $state(SyncStatus.Idle);

  async init() {
    this.pages = await trpc.pages.list.query();
  }
}

const state = new ServerState();

export default {
  trpc,
  state,
};
