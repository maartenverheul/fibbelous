import { WorkspaceInfo } from "@/models";
import { createContext, PropsWithChildren, useContext, useMemo } from "react";
import { useAppNavigation } from "./AppNavigationContext";
import { useWorkspaceManager } from "./WorkspaceManagerContext";

const PageContext = createContext<WorkspaceInfo | undefined>(undefined);

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { urlWorkspaceSlug } = useAppNavigation();
  const workspaceManager = useWorkspaceManager();

  const data = useMemo<WorkspaceInfo | undefined>(() => {
    if (!urlWorkspaceSlug) return undefined;
    const workspace = workspaceManager.getWorkspaceBySlug(urlWorkspaceSlug);
    return workspace;
  }, [urlWorkspaceSlug]);

  return <PageContext.Provider value={data}>{children}</PageContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(PageContext);
  // if (!ctx)
  //   throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return ctx;
}
