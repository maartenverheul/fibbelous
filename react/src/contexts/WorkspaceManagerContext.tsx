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
  deleteWorkspace(id: string): void;
  pickLocal(existing: boolean): Promise<AddLocalRepoResponse>;
  fetchRemoteWorkspaces(url: string): Promise<WorkspaceInfo[]>;
  saveRemoteWorkspaces(...workspaces: WorkspaceConnection[]): Promise<void>;
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
    WorkspaceConnection[]
  >("remoteWorkspaces", {
    defaultValue: [],
  });
  const [list, setList] = useState<WorkspaceInfo[]>(
    remoteWorkspaces.map((w) => w.info!)
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

  async function deleteWorkspace(id: string) {
    if (!IS_APP) return;
    try {
      const ok = (await invoke("remove_workspace", { id })) as boolean;
      if (ok) {
        setList((prev) => prev.filter((w) => w.id !== id));
      } else {
        console.warn("remove_workspace returned false for id", id);
      }
    } catch (err) {
      console.error("Failed to delete workspace", id, err);
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

  async function saveRemoteWorkspaces(
    ...workspaces: WorkspaceConnection[]
  ): Promise<void> {
    if (!IS_APP) {
      setRemoteWorkspaces((prev) => [...prev, ...workspaces]);
    } else {
      try {
        await invoke("save_remote_workspaces", {
          workspaces,
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
        deleteWorkspace,
        pickLocal,
        fetchRemoteWorkspaces,
        saveRemoteWorkspaces,
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
