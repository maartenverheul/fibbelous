import {
  AddLocalRepoResponse,
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
import { IS_APP } from "@/checks";
import useLocalStorageState from "use-local-storage-state";

export type WorkspaceManagerContextType = {
  list: WorkspaceInfo[];
  selectedWorkspaceId?: string;
  loaded: boolean;
  getWorkspace(id: string): WorkspaceInfo | undefined;
  getWorkspaceBySlug(slug: string): WorkspaceInfo | undefined;
  switchWorkspace(id: string): void;
  addWorkspace(workspace: WorkspaceInfo): void;
  updateWorkspace(workspace: WorkspaceInfo): void;
  removeWorkspace(id: string): void;
  pickLocal(existing: boolean): Promise<AddLocalRepoResponse>;
  fetchRemoteWorkspaces(url: string): Promise<WorkspaceInfo[]>;
  openInSystem(id: string): void;
};

export const WorkspaceManagerContext = createContext<
  WorkspaceManagerContextType | undefined
>(undefined);

export function WorkspaceManagerProvider({
  children,
}: {
  children: ReactNode;
}) {
  // Initial workspaces can be loaded from a static list or fetched from an API
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<
    string | undefined
  >(undefined);
  const [loaded, setLoaded] = useState(false);
  const [remoteWorkspaces, setRemoteWorkspaces] = useLocalStorageState<
    WorkspaceInfo[]
  >("remoteWorkspaces", {
    defaultValue: [],
  });
  const [list, setList] = useState<WorkspaceInfo[]>(
    remoteWorkspaces
  );

  useEffect(() => {
    if (!IS_APP) {
      setLoaded(true);
      return;
    }
    invoke("get_saved_workspaces")
      .then((result) => {
        const workspaces = result as WorkspaceInfo[];
        console.log("Saved workspaces", workspaces);

        const match = location.pathname.match(/^\/(\w[\w\s-]*)/);
        const requestedSlug = match ? match[1] : "";
        const initialWorkspace =
          workspaces.find((w) => w.slug === requestedSlug) ?? workspaces[0];

        setSelectedWorkspaceId(initialWorkspace?.id);

        setList(workspaces);
      })
      .catch((err) => {
        console.error("Failed to load saved workspaces", err);
        setList([]);
        setSelectedWorkspaceId(undefined);
      })
      .finally(() => setLoaded(true));
  }, []);

  function switchWorkspace(id: string) {
    if (
      selectedWorkspaceId &&
      !list.some((w) => w.id === selectedWorkspaceId)
    ) {
      setSelectedWorkspaceId(list[0]?.id);
      return;
    }
    setSelectedWorkspaceId(id);
  }

  function addWorkspace(workspace: WorkspaceInfo) {
    if (workspace.connection?.url) {
      saveRemoteWorkspace(workspace);
    }
    setList((prev) => [...prev, workspace]);
  }

  function getWorkspace(id: string): WorkspaceInfo | undefined {
    return list.find((w) => w.id === id);
  }

  function getWorkspaceBySlug(slug: string): WorkspaceInfo | undefined {
    return list.find((w) => w.slug === slug);
  }

  function updateWorkspace(workspace: WorkspaceInfo) {
    setList((prev) => prev.map((w) => (w.id === workspace.id ? workspace : w)));
  }

  async function removeWorkspace(id: string) {
    let ok = true;
    if (IS_APP) {
      try {
        const ok = (await invoke("remove_workspace", { id })) as boolean;
        if (!ok) console.warn("remove_workspace returned false for id", id);
      } catch (err) {
        console.error("Failed to delete workspace", id, err);
      }
    } else {
      remoteWorkspaces.splice(remoteWorkspaces.findIndex(w => w?.id === id), 1);
      setRemoteWorkspaces(remoteWorkspaces);
    }
    if (ok) {
      setList((prev) => prev.filter((w) => w.id !== id));
    }
  }

  async function pickLocal(existing: boolean): Promise<AddLocalRepoResponse> {
    if (!IS_APP) throw new Error("Not implemented in web");
    try {
      const res = (await invoke("add_local_repository", {
        existing,
      })) as AddLocalRepoResponse;
      if (!res.ok) return { ok: false, error: res.error };
      const ws = res.workspace!;
      setList((prev) => [...prev, ws]);
      setSelectedWorkspaceId(ws.id);
      return { ok: true, workspace: ws };
    } catch (err) {
      console.error("add_local_repository failed", err);
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

  async function saveRemoteWorkspace(
    workspace: WorkspaceInfo
  ): Promise<void> {
    if (!workspace.connection) throw new Error("No connection info");
    if (!IS_APP) {
      setRemoteWorkspaces((prev) => [...prev, workspace]);
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

  function openInSystem(id: string) {
    if (!IS_APP) throw new Error("Not implemented in web");
    invoke("open_workspace_in_system", { id });
  }

  return (
    <WorkspaceManagerContext.Provider
      value={{
        list,
        selectedWorkspaceId,
        loaded,
        getWorkspace,
        getWorkspaceBySlug,
        switchWorkspace,
        addWorkspace,
        updateWorkspace,
        removeWorkspace,
        pickLocal,
        fetchRemoteWorkspaces,
        openInSystem,
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
