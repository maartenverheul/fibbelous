import { createContext, useContext, useState, ReactNode } from "react";

export type Workspace = {
  id: string;
  name: string;
};

export type WorkspaceContextType = {
  workspaces: Workspace[];
  setWorkspaces: (workspaces: Workspace[]) => void;
};

export const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined
);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  // Initial workspaces can be loaded from a static list or fetched from an API
  const [workspaces, setWorkspaces] = useState<Workspace[]>([
    { id: "test", name: "Test" },
    { id: "test2", name: "Test 2" },
  ]);
  return (
    <WorkspaceContext.Provider value={{ workspaces, setWorkspaces }}>
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
