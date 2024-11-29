import { io } from "socket.io-client";
import type {
  ClientCommandHandler,
  ServerCommandHandler,
} from "@fibbelous/server/lib";

export enum SyncStatus {
  Idle = "idle",
  Loading = "loading",
  Saving = "saving",
  Error = "error",
}

export class ServerState {
  pages: string[] = $state([]);
  activePage: string | null = $state(null);
  syncStatus: SyncStatus = $state(SyncStatus.Idle);
}

const state = new ServerState();

const socket = io("http://localhost:3000");

socket.on("connect", () => {
  actions.listPages();
});

socket.onAny((event, ...args) => {
  if (event in serverHandler) {
    const e = event as keyof ServerCommandHandler;
    const fn = serverHandler[e] as any;
    fn(...args);
  }
});

const serverHandler: ServerCommandHandler = {
  listPages(data) {
    state.pages = data;
  },
  pageCreated(id) {
    state.pages.push(id);
  },
  pageDeleted(id) {
    const index = state.pages.indexOf(id);
    state.pages.splice(index, 1);
  },
  pageLoaded(content) {
    state.activePage = content;
  },
};

type CustomActions = {
  disconnect: () => void;
};

const actions: ClientCommandHandler & CustomActions = {
  listPages() {
    emit("listPages");
  },
  createPage(name: string) {
    emit("createPage", name);
  },
  deletePage(id: string) {
    emit("deletePage", id);
  },
  loadPage(id: string) {
    emit("loadPage", id);
  },
  disconnect() {
    socket.disconnect();
  },
};

function emit<T extends keyof typeof actions>(
  event: T,
  ...args: Parameters<(typeof actions)[T]>
) {
  socket.emit(event, ...args);
}

export default {
  ...actions,
  state,
};
