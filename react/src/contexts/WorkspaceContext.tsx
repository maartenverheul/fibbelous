import { Workspace } from "@/models";
import { createContext, PropsWithChildren, useContext, useMemo } from "react";
import { useAppNavigation } from "./AppNavigationContext";
import { useWorkspaceManager } from "./WorkspaceManagerContext";
import { ServerProvider } from "./ServerContext";

const WorkspaceContext = createContext<Workspace | undefined>(undefined);

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { urlWorkspaceSlug } = useAppNavigation();
  const workspaceManager = useWorkspaceManager();

  const workspace = useMemo<Workspace | undefined>(() => {
    if (!urlWorkspaceSlug) return undefined;
    return workspaceManager.getWorkspaceBySlug(urlWorkspaceSlug);
  }, [urlWorkspaceSlug, workspaceManager]);

  return (
    <ServerProvider workspace={workspace}>
      <WorkspaceContext.Provider value={workspace}>
        {children}
      </WorkspaceContext.Provider>
    </ServerProvider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
