import localforage from "localforage";
import type { Page, Workspace } from "@fibbelous/server/lib";
import serverStore from "./server.svelte";
import type { RemoteWorkspace } from "./types/RemoteWorkspace";

const store = localforage.createInstance({
  name: "workspaces",
  driver: localforage.LOCALSTORAGE,
});

export class WorkspaceStore {
  currentWorkspace: RemoteWorkspace | null = $state(null);
  savedWorkspaces: RemoteWorkspace[] = $state([]);
  pages: Page[] = $state([]);

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
    await serverStore.connect(this.currentWorkspace.url);

    await serverStore.trpc.loadWorkspace.query(this.currentWorkspace.id);

    // Init pages
    this.pages = await serverStore.trpc.workspace.pages.list.query();
    serverStore.trpc.workspace.pages.onAdd.subscribe(undefined, {
      onData: (value) => {
        this.pages.push(value);
      },
    });
    serverStore.trpc.workspace.pages.onDelete.subscribe(undefined, {
      onData: (value) => {
        const index = this.pages.findIndex((p) => p.id == value);
        if (index >= 0) this.pages.splice(index, 1);
      },
    });
  }

  // async open(workspace: Workspace) {
  //   this.currentWorkspace = {
  //     id: workspace.id,
  //     url: workspace.url,
  //     name: workspace.name,
  //   };

  //   // Save workspace settings
  //   this.savedWorkspaces.push(this.currentWorkspace);
  //   await store.setItem("saved", $state.snapshot(this.savedWorkspaces));

  //   // Set current workspace
  //   await store.setItem("open", $state.snapshot(this.currentWorkspace));
  // }

  async open(workspace: RemoteWorkspace) {
    this.currentWorkspace = {
      id: workspace.id,
      url: workspace.url,
      name: workspace.name,
    };

    await store.setItem("open", $state.snapshot(this.currentWorkspace));
  }
}

const workspaceStore = new WorkspaceStore();
export default workspaceStore;
