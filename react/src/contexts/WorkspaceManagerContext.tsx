import {
  AddLocalRepoResponse,
  ConnectionType,
  CreateWorkspaceRequest,
  Workspace,
  WorkspaceConnection,
  WorkspaceInfo,
} from "@/models";
import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { open } from "@tauri-apps/api/dialog";
import { IS_APP } from "@/checks";
import useLocalStorageState from "use-local-storage-state";
import update from "immutability-helper";
import { useServer } from "./ServerContext";

export type WorkspaceManagerContextType = {
  workspaces: Workspace[];
  loaded: boolean;
  getWorkspace(id: string): Workspace | undefined;
  getWorkspaceBySlug(slug: string): Workspace | undefined;
  addWorkspace(workspace: Workspace): void;
  createWorkspace(
    request: CreateWorkspaceRequest,
    url?: string
  ): Promise<WorkspaceInfo>;
  updateWorkspace(workspace: WorkspaceInfo): void;
  removeWorkspace(id: string): void;
  pickLocal(existing: boolean): Promise<AddLocalRepoResponse>;
  fetchRemoteWorkspaces(url: string): Promise<WorkspaceInfo[]>;
  openInSystem(id: string): void;
  forceRefreshRemote(): void;
};
const WorkspaceManagerContext = createContext<
  WorkspaceManagerContextType | undefined
>(undefined);

// Previously attempted to auto-select an initial workspace; logic removed.
export function WorkspaceManagerProvider({
  children,
}: {
  children: ReactNode;
}) {
  const server = useServer();
  const [loaded, setLoaded] = useState(false);
  const [remoteWorkspaces, setRemoteWorkspaces] = useLocalStorageState<
    WorkspaceConnection[]
  >("remoteWorkspaces", {
    defaultValue: [],
  });
  const [list, setList] = useState<Workspace[]>(
    remoteWorkspaces.map(
      (conn) =>
      ({
        info: conn.cachedInfo,
        connection: conn,
        connectionState: {},
      } satisfies Workspace)
    )
  );

  useEffect(() => {
    if (!IS_APP) {
      refreshAllRemoteWorkspaces();
      setLoaded(true);
      return;
    }
    server.dispatch("getSavedWorkspaces", {})
      .then((workspaceInfos) => {
        console.log("Saved workspaces", workspaceInfos);

        // Previously used to auto-select workspace based on URL slug; removed.
        setList(
          workspaceInfos.map((info) => ({
            info,
            connection: {
              cachedInfo: info,
              url: undefined,
              type: ConnectionType.local,
            },
            connectionState: { success: true, checking: false },
          }))
        );
      })
      .catch((err) => {
        console.error("Failed to load saved workspaces", err);
        setList([]);
        // setSelectedWorkspaceId(undefined);
      })
      .finally(() => setLoaded(true));
  }, []);

  async function refreshAllRemoteWorkspaces() {
    // Build map of URL -> workspaces to refresh
    const groups = new Map<string, Workspace[]>();
    for (const w of list) {
      const url = w.connection?.url;
      if (!url) continue;
      if (!groups.has(url)) groups.set(url, []);
      groups.get(url)!.push(w);
    }
    if (groups.size === 0) return;
    console.debug("[WorkspaceManager] Refreshing remote workspaces (per workspace)", {
      groups: Array.from(groups.keys()),
    });

    // We'll construct an updated list progressively
    let updated = [...list];
    for (const [url, workspaces] of groups.entries()) {
      // Fetch each workspace individually in parallel
      const results = await Promise.all(
        workspaces.map(async (w) => {
          try {
            const remote = await fetchRemoteWorkspace(url, w.info.id);
            if (!remote) {
              return {
                id: w.info.id,
                state: {
                  success: false,
                  error: "Workspace not found on server",
                  checking: false,
                },
              } as const;
            }
            return {
              id: w.info.id,
              state: { success: true, checking: false } as const,
            } as const;
          } catch (err) {
            return {
              id: w.info.id,
              state: {
                success: false,
                error: (err as Error)?.message || "Connection failed",
                checking: false,
              },
            } as const;
          }
        })
      );

      // Apply results
      updated = updated.map((w) => {
        if (!workspaces.some((ww) => ww.info.id === w.info.id)) return w;
        const res = results.find((r) => r.id === w.info.id);
        if (!res) return w;
        const urlValue = w.connection?.url || url;
        return {
          ...w,
          connectionState: res.state,
          connection: {
            url: urlValue,
            cachedInfo: w.info, // keep existing cached info
            type: url ? ConnectionType.remote : ConnectionType.local,
          },
        } satisfies Workspace;
      });
    }

    console.debug("[WorkspaceManager] Applied per-workspace remote refresh results");
    setList(updated);
    if (!IS_APP) {
      const updatedRemote = updated.filter((w) => w.connection?.url);
      setRemoteWorkspaces(updatedRemote.map((w) => w.connection!));
    }
  }

  function addWorkspace(workspace: Workspace) {
    if (workspace.connection?.url) {
      saveRemoteWorkspace(workspace);
    }
    setList((prev) => [...prev, workspace]);
  }

  function forceRefreshRemote() {
    // Mark remote workspaces as checking, then run refresh
    setList((prev) =>
      prev.map((w) =>
        w.connection?.url
          ? { ...w, connectionState: { ...w.connectionState, checking: true } }
          : w
      )
    );
    refreshAllRemoteWorkspaces();
  }

  function getWorkspace(id: string): Workspace | undefined {
    return list.find((w) => w.info.id === id);
  }

  function getWorkspaceBySlug(slug: string): Workspace | undefined {
    return list.find((w) => w.info.slug === slug);
  }

  function updateWorkspace(workspace: WorkspaceInfo) {
    setList((prev) => {
      const index = prev.findIndex((w) => w.info.id === workspace.id);
      if (index === -1) return prev;
      return update(prev, {
        [index]: {
          info: { $set: workspace },
          connection: { cachedInfo: { $set: workspace } },
        },
      });
    });
  }

  async function removeWorkspace(id: string) {
    let ok = true;
    if (IS_APP) {
      try {
        const ok = (await server.dispatch("removeSavedWorkspace", { id })) as boolean;
        if (!ok) console.warn("remove_workspace returned false for id", id);
      } catch (err) {
        console.error("Failed to delete workspace", id, err);
      }
    } else {
      remoteWorkspaces.splice(
        remoteWorkspaces.findIndex((w) => w.cachedInfo.id === id),
        1
      );
      setRemoteWorkspaces(remoteWorkspaces);
    }
    if (ok) {
      setList((prev) => prev.filter((w) => w.info.id !== id));
    }
  }

  async function pickLocal(existing: boolean): Promise<AddLocalRepoResponse> {
    if (!IS_APP) throw new Error("Not implemented in web");
    try {
      // Let user pick a directory
      const dir = await open({
        directory: true,
        multiple: false,
        title: existing ? "Select Existing Workspace Folder" : "Select Folder for New Workspace",
      });
      if (!dir || typeof dir !== "string") {
        return { ok: false, error: "No folder selected" };
      }
      // Send the selected path to the server via addLocalRepository command using server.dispatch
      const res = (await server.dispatch("addLocalRespository", {
        path: dir,
        existing,
      })) as AddLocalRepoResponse;
      if (!res.ok) return { ok: false, error: res.error };
      const workspace: Workspace = {
        info: res.workspace!,
        connection: {
          url: undefined,
          type: ConnectionType.local,
          cachedInfo: res.workspace!,
        },
        connectionState: { success: true },
      };
      setList((prev) => [...prev, workspace]);
      return { ok: true, workspace: res.workspace };
    } catch (err) {
      console.error("addLocalRepository failed", err);
      return { ok: false };
    }
  }

  async function fetchRemoteWorkspaces(url: string): Promise<WorkspaceInfo[]> {
    try {
      const res = await fetch(`${url}/api/workspaces`);
      if (!res.ok) throw new Error(res.statusText);
      return await res.json();
    } catch (err) {
      console.error("fetch_remote_workspaces failed", err);
      throw err;
    }
  }

  async function fetchRemoteWorkspace(
    url: string,
    id: string
  ): Promise<WorkspaceInfo | null> {
    try {
      const res = await fetch(`${url}/api/workspaces/${id}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(res.statusText);
      return (await res.json()) as WorkspaceInfo;
    } catch (err) {
      console.error("fetch_remote_workspace failed", id, err);
      throw err;
    }
  }

  async function saveRemoteWorkspace(workspace: Workspace): Promise<void> {
    if (!workspace.connection) throw new Error("No connection info");
    if (!IS_APP) {
      workspace.connection.cachedInfo = workspace.info;
      setRemoteWorkspaces((prev) => [...prev, workspace.connection]);
    } else {
      try {
        await invoke("save_remote_workspaces", {
          workspaces: [workspace],
        });
      } catch (err) {
        console.error("save_remote_workspaces failed", err);
        throw err;
      }
    }
  }

  async function createWorkspace(
    request: CreateWorkspaceRequest,
    url?: string
  ): Promise<WorkspaceInfo> {
    if (url === undefined) {
      // Local workspace, just add
      throw new Error("Not implemented for local workspaces");
    }
    const response = await fetch(`${url}/api/workspaces`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new Error(`Failed to create workspace: ${response.statusText}`);
    }

    const info = (await response.json()) as WorkspaceInfo;
    const workspace: Workspace = {
      info,
      connection: {
        url,
        type: ConnectionType.remote,
        cachedInfo: info,
      },
      connectionState: { success: true, checking: false },
    };
    addWorkspace(workspace);
    return info;
  }

  function openInSystem(id: string) {
    if (!IS_APP) throw new Error("Not implemented in web");
    invoke("open_workspace_in_system", { id });
  }

  return (
    <WorkspaceManagerContext.Provider
      value={{
        workspaces: list,
        loaded,
        getWorkspace,
        getWorkspaceBySlug,
        addWorkspace,
        createWorkspace,
        updateWorkspace,
        removeWorkspace,
        pickLocal,
        fetchRemoteWorkspaces,
        openInSystem,
        forceRefreshRemote,
      }}
    >
      {children}
    </WorkspaceManagerContext.Provider>
  );
}

export function useWorkspaceManager() {
  const ctx = useContext(WorkspaceManagerContext);
  if (!ctx)
    throw new Error(
      "useWorkspaceManager must be used within a WorkspaceManagerProvider"
    );
  return ctx;
}
