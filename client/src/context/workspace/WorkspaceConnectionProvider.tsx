import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  isWorkspaceNotFoundError,
  openLocalWorkspaceConnection,
  openRemoteWorkspaceConnection,
} from "../../lib/api/api";
import type { RpcClient } from "../../lib/api/rpc";
import {
  buildWorkspaceConnectionKey,
  closePooledConnection,
  getPooledConnection,
} from "../../lib/api/workspaceConnection";
import {
  workspaceManagerRedirectState,
  type WorkspaceNotice,
} from "../../lib/app/navigation";
import {
  isLocalWorkspace,
  type WorkspaceConnectionStatus,
} from "../../lib/api/workspace";
import { useWorkspaceSession } from "./WorkspaceSessionProvider";

export type WorkspaceConnectionValue = {
  rpc: RpcClient | null;
  connectionStatus: WorkspaceConnectionStatus;
  connectionGenerationRef: RefObject<number>;
};

const WorkspaceConnectionContext =
  createContext<WorkspaceConnectionValue | null>(null);

export function WorkspaceConnectionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const {
    activeWorkspace,
    removeWorkspace,
    setActive,
    suppressActiveSyncRef,
  } = useWorkspaceSession();

  const [connectionStatus, setConnectionStatus] =
    useState<WorkspaceConnectionStatus>("idle");
  const [rpc, setRpc] = useState<RpcClient | null>(null);
  const connectionGenerationRef = useRef(0);

  useEffect(() => {
    const workspace = activeWorkspace;
    if (!workspace) {
      closePooledConnection();
      setConnectionStatus("idle");
      setRpc(null);
      return;
    }

    let cancelled = false;
    const connectAttempt = ++connectionGenerationRef.current;
    const connectionKey = buildWorkspaceConnectionKey(workspace);

    const redirectToWorkspaceManager = (notice: WorkspaceNotice) => {
      if (connectAttempt !== connectionGenerationRef.current) return;
      suppressActiveSyncRef.current = true;
      navigate("/", {
        replace: true,
        state: workspaceManagerRedirectState(notice),
      });
    };

    const existingClient = getPooledConnection(connectionKey);
    if (existingClient) {
      setRpc(existingClient);
      setConnectionStatus("connected");
      suppressActiveSyncRef.current = false;
      return () => {
        cancelled = true;
      };
    }

    setConnectionStatus("connecting");

    void (async () => {
      try {
        const client =
          isLocalWorkspace(workspace) && workspace.localPath
            ? await openLocalWorkspaceConnection(
                workspace.localPath,
                workspace.workspaceId,
              )
            : await openRemoteWorkspaceConnection(
                workspace.serverUrl,
                workspace.workspaceId,
              );
        if (cancelled) return;
        if (connectAttempt !== connectionGenerationRef.current) return;

        setRpc(client);
        setConnectionStatus("connected");
        suppressActiveSyncRef.current = false;
      } catch (error) {
        if (cancelled) return;
        if (connectAttempt !== connectionGenerationRef.current) return;
        if (
          error instanceof Error &&
          error.message === "Workspace connection superseded"
        ) {
          return;
        }
        if (isWorkspaceNotFoundError(error)) {
          suppressActiveSyncRef.current = true;
          removeWorkspace(workspace.id);
          redirectToWorkspaceManager({
            kind: "missing",
            label: workspace.label,
          });
          return;
        }
        suppressActiveSyncRef.current = true;
        setActive(null);
        redirectToWorkspaceManager({
          kind: "connectionFailed",
          label: workspace.label,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeWorkspace?.id,
    activeWorkspace?.serverUrl,
    activeWorkspace?.workspaceId,
    activeWorkspace?.localPath,
    removeWorkspace,
    navigate,
    setActive,
    suppressActiveSyncRef,
  ]);

  const value = useMemo(
    () => ({
      rpc,
      connectionStatus,
      connectionGenerationRef,
    }),
    [rpc, connectionStatus],
  );

  return (
    <WorkspaceConnectionContext.Provider value={value}>
      {children}
    </WorkspaceConnectionContext.Provider>
  );
}

export function useWorkspaceConnection() {
  const context = useContext(WorkspaceConnectionContext);
  if (!context) {
    throw new Error(
      "useWorkspaceConnection must be used within WorkspaceConnectionProvider",
    );
  }
  return context;
}

export function useWorkspaceConnectionOptional() {
  return useContext(WorkspaceConnectionContext);
}
