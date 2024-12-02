import localforage from "localforage";
import type { Workspace } from "@fibbelous/server/lib";
import serverStore from "./server.svelte";
import type { RemoteWorkspace } from "./types/RemoteWorkspace";
import type { Server } from "./Server";

const store = localforage.createInstance({
  name: "workspaces",
  driver: localforage.LOCALSTORAGE,
});

export class WorkspaceStore {
  currentWorkspace: RemoteWorkspace | null = $state(null);
  savedWorkspaces: RemoteWorkspace[] = $state([]);

  constructor() {}

  async init() {
    this.savedWorkspaces =
      (await store.getItem<RemoteWorkspace[]>("saved")) ?? [];
    this.currentWorkspace = await store.getItem<RemoteWorkspace>("open");

    if (!this.currentWorkspace) return;
    if (!this.currentWorkspace?.id) {
      this.currentWorkspace = null;
      return;
    }
    const server = await serverStore.connect(this.currentWorkspace.url);

    await server.trpc?.loadWorkspace.query(this.currentWorkspace.id);
    await server.trpc?.workspace.pages.list.query();
  }

  async open(server: Server, workspace: Workspace) {
    this.currentWorkspace = {
      id: workspace.id,
      url: server.url,
      name: workspace.name,
    };

    // Save workspace settings
    this.savedWorkspaces.push(this.currentWorkspace);
    await store.setItem("saved", $state.snapshot(this.savedWorkspaces));

    // Set current workspace
    this.currentWorkspace = this.currentWorkspace;
    await store.setItem("open", $state.snapshot(this.currentWorkspace));
  }
}

const workspaceStore = new WorkspaceStore();
export default workspaceStore;
