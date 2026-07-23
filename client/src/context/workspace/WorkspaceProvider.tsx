import type { ReactNode } from "react";
import { WorkspaceConnectionProvider } from "./WorkspaceConnectionProvider";
import { WorkspacePagesProvider } from "./WorkspacePagesProvider";
import { WorkspaceSessionProvider } from "./WorkspaceSessionProvider";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  return (
    <WorkspaceSessionProvider>
      <WorkspaceConnectionProvider>
        <WorkspacePagesProvider>{children}</WorkspacePagesProvider>
      </WorkspaceConnectionProvider>
    </WorkspaceSessionProvider>
  );
}
