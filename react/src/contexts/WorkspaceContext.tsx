import { WorkspaceInfo } from "@/models";
import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { useNavigate } from "react-router";

export type WorkspaceContextType = {
  workspaces: WorkspaceInfo[];
  addWorkspace: (workspace: WorkspaceInfo) => void;
  updateWorkspace: (workspace: WorkspaceInfo) => void;
  deleteWorkspace: (id: string) => void;
  pickLocal: () => Promise<WorkspaceInfo | null>;
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

  function deleteWorkspace(id: string) {
    setWorkspaces((prev) => prev.filter((w) => w.id !== id));
  }

  async function pickLocal(): Promise<WorkspaceInfo | null> {
    const result = (await invoke(
      "open_local_repository"
    )) as WorkspaceInfo | null;
    if (!result) return null;
    setWorkspaces((prev) => [...prev, result]);
    return result;
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
