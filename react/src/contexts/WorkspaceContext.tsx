import { createContext, useContext, useState, ReactNode } from "react";

export type Workspace = {
  id: string;
  icon: string;
  name: string;
};

export type WorkspaceContextType = {
  workspaces: Workspace[];
  addWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (workspace: Workspace) => void;
  deleteWorkspace: (id: string) => void;
};

export const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined
);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  // Initial workspaces can be loaded from a static list or fetched from an API
  const [workspaces, setWorkspaces] = useState<Workspace[]>([
    { id: "test", icon: "🏠", name: "Test" },
    { id: "test2", icon: "😁", name: "Test 2" },
  ]);

  const addWorkspace = (workspace: Workspace) => {
    setWorkspaces((prev) => [...prev, workspace]);
  };

  const updateWorkspace = (workspace: Workspace) => {
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === workspace.id ? workspace : w))
    );
  };

  const deleteWorkspace = (id: string) => {
    setWorkspaces((prev) => prev.filter((w) => w.id !== id));
  };

  return (
    <WorkspaceContext.Provider
      value={{ workspaces, addWorkspace, updateWorkspace, deleteWorkspace }}
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
