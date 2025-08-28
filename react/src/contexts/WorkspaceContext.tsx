import { AddLocalRepoResponse, WorkspaceInfo } from "@/models";
import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { invoke } from "@tauri-apps/api/tauri";

export type WorkspaceContextType = {
  workspaces: WorkspaceInfo[];
  selectedWorkspaceId?: string;
  loaded: boolean;
  switchWorkspace: (id: string) => void;
  addWorkspace: (workspace: WorkspaceInfo) => void;
  updateWorkspace: (workspace: WorkspaceInfo) => void;
  deleteWorkspace: (id: string) => void;
  pickLocal: (existing: boolean) => Promise<AddLocalRepoResponse>;
};

export const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined
);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  // Initial workspaces can be loaded from a static list or fetched from an API
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);


  useEffect(() => {
    invoke("get_saved_workspaces")
      .then((result) => {
        const workspaces = result as WorkspaceInfo[];
        console.log("Saved workspaces", workspaces);

        const match = location.pathname.match(/^\/(\w[\w\s-]*)/);
        const requestedSlug = match ? match[1] : "";
        const initialWorkspace =
          workspaces.find((w) => w.slug === requestedSlug) ?? workspaces[0];

        setSelectedWorkspaceId(initialWorkspace?.id);

        setWorkspaces(workspaces);
      })
      .catch((err) => {
        console.error("Failed to load saved workspaces", err);
        setWorkspaces([]);
        setSelectedWorkspaceId(undefined);
      })
      .finally(() => setLoaded(true));
  }, []);

  function switchWorkspace(id: string) {
    if (selectedWorkspaceId && !workspaces.some((w) => w.id === selectedWorkspaceId)) {
      setSelectedWorkspaceId(workspaces[0]?.id);
      return;
    }
    setSelectedWorkspaceId(id);
  }

  function addWorkspace(workspace: WorkspaceInfo) {
    setWorkspaces((prev) => [...prev, workspace]);
  }

  function updateWorkspace(workspace: WorkspaceInfo) {
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === workspace.id ? workspace : w))
    );
  }

  async function deleteWorkspace(id: string) {
    try {
      const ok = (await invoke("delete_workspace", { id })) as boolean;
      if (ok) {
        setWorkspaces((prev) => prev.filter((w) => w.id !== id));
      } else {
        console.warn("delete_workspace returned false for id", id);
      }
    } catch (err) {
      console.error("Failed to delete workspace", id, err);
    }
  }

  async function pickLocal(existing: boolean): Promise<AddLocalRepoResponse> {
    try {
      const res = (await invoke("add_local_repository", {
        existing
      })) as AddLocalRepoResponse;
      if (!res.ok) return { ok: false, error: res.error };
      const ws = res.workspace!;
      setWorkspaces((prev) => [...prev, ws]);
      setSelectedWorkspaceId(ws.id);
      return { ok: true, workspace: ws };
    } catch (err) {
      console.error("add_local_repository failed", err);
      return { ok: false };
    }
  }

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        selectedWorkspaceId,
        loaded,
        switchWorkspace,
        addWorkspace,
        updateWorkspace,
        deleteWorkspace,
        pickLocal,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceContext() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx)
    throw new Error(
      "useWorkspaceContext must be used within a WorkspaceProvider"
    );
  return ctx;
}
