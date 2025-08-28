import { WorkspaceInfo } from "@/models";
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
  addWorkspace: (workspace: WorkspaceInfo) => void;
  updateWorkspace: (workspace: WorkspaceInfo) => void;
  deleteWorkspace: (id: string) => void;
  pickLocal: () => Promise<{ ok: boolean; error?: string | null; workspace?: WorkspaceInfo | null }>;
};

export const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined
);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  // Initial workspaces can be loaded from a static list or fetched from an API
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);

  useEffect(() => {
    invoke("get_saved_workspaces").then((workspaces) => {
      console.log(workspaces);

      setWorkspaces(workspaces as WorkspaceInfo[]);
    });
  }, []);

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

  async function pickLocal(): Promise<{ ok: boolean; error?: string | null; workspace?: WorkspaceInfo | null }> {
    type OpenLocalRepoResponse = {
      ok: boolean;
      error?: string | null;
      workspace?: WorkspaceInfo | null;
    };
    try {
      const res = (await invoke("open_local_repository")) as OpenLocalRepoResponse;
      if (!res.ok) return { ok: false, error: res.error ?? "Failed to open workspace" };
      const ws = res.workspace!;
      setWorkspaces((prev) => [...prev, ws]);
      return { ok: true, workspace: ws };
    } catch (err) {
      console.error("open_local_repository failed", err);
      return { ok: false, error: "Failed to open workspace" };
    }
  }

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
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
