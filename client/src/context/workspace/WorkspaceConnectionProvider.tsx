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

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 5_000;

function reconnectDelayMs(attempt: number): number {
  const exp = Math.min(
    RECONNECT_BASE_MS * 2 ** Math.max(0, attempt - 1),
    RECONNECT_MAX_MS,
  );
  return exp;
}

export type WorkspaceConnectionValue = {
  rpc: RpcClient | null;
  connectionStatus: WorkspaceConnectionStatus;
  connectionGenerationRef: RefObject<number>;
  /** 0 when connected / idle; otherwise the next reconnect attempt number (1-based). */
  reconnectAttempt: number;
};

const WorkspaceConnectionContext =
  createContext<WorkspaceConnectionValue | null>(null);

export function WorkspaceConnectionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { activeWorkspace, removeWorkspace, setActive, suppressActiveSyncRef } =
    useWorkspaceSession();

  const [connectionStatus, setConnectionStatus] =
    useState<WorkspaceConnectionStatus>("idle");
  const [rpc, setRpc] = useState<RpcClient | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const connectionGenerationRef = useRef(0);

  useEffect(() => {
    const workspace = activeWorkspace;
    if (!workspace) {
      closePooledConnection();
      setConnectionStatus("idle");
      setRpc(null);
      setReconnectAttempt(0);
      return;
    }

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let unsubscribeClose: (() => void) | null = null;
    let attempt = 0;
    let hasConnected = false;
    const connectAttempt = ++connectionGenerationRef.current;
    const connectionKey = buildWorkspaceConnectionKey(workspace);
    const isLocal = isLocalWorkspace(workspace) && Boolean(workspace.localPath);

    const isCurrent = () =>
      !cancelled && connectAttempt === connectionGenerationRef.current;

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const redirectToWorkspaceManager = (notice: WorkspaceNotice) => {
      if (!isCurrent()) return;
      suppressActiveSyncRef.current = true;
      navigate("/", {
        replace: true,
        state: workspaceManagerRedirectState(notice),
      });
    };

    const failInitialConnect = (error: unknown) => {
      if (!isCurrent()) return;
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
    };

    const scheduleReconnect = () => {
      if (!isCurrent() || isLocal) return;

      clearReconnectTimer();
      attempt += 1;
      const delay = reconnectDelayMs(attempt);
      setReconnectAttempt(attempt);
      setConnectionStatus("disconnected");
      setRpc(null);

      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void connect(true);
      }, delay);
    };

    const watchClient = (client: RpcClient) => {
      unsubscribeClose?.();
      unsubscribeClose = client.onClose(() => {
        if (!isCurrent()) return;
        // Drop the dead pooled entry so the next open creates a fresh socket.
        closePooledConnection();
        setRpc(null);
        if (isLocal) {
          setConnectionStatus("disconnected");
          setReconnectAttempt(0);
          return;
        }
        scheduleReconnect();
      });
    };

    const connect = async (isReconnect: boolean) => {
      if (!isCurrent()) return;

      clearReconnectTimer();

      if (!isReconnect) {
        setConnectionStatus("connecting");
        setReconnectAttempt(0);
      } else {
        setConnectionStatus("disconnected");
      }

      try {
        const existingClient = getPooledConnection(connectionKey);
        const client =
          existingClient ??
          (isLocal && workspace.localPath
            ? await openLocalWorkspaceConnection(
                workspace.localPath,
                workspace.workspaceId,
              )
            : await openRemoteWorkspaceConnection(
                workspace.serverUrl,
                workspace.workspaceId,
              ));

        if (!isCurrent()) return;

        hasConnected = true;
        attempt = 0;
        setReconnectAttempt(0);
        setRpc(client);
        setConnectionStatus("connected");
        suppressActiveSyncRef.current = false;
        watchClient(client);
      } catch (error) {
        if (!isCurrent()) return;
        if (
          error instanceof Error &&
          error.message === "Workspace connection superseded"
        ) {
          return;
        }

        if (isReconnect || hasConnected) {
          scheduleReconnect();
          return;
        }

        failInitialConnect(error);
      }
    };

    void connect(false);

    return () => {
      cancelled = true;
      clearReconnectTimer();
      unsubscribeClose?.();
      unsubscribeClose = null;
    };
  }, [
    activeWorkspace?.id,
    activeWorkspace?.serverUrl,
    activeWorkspace?.workspaceId,
    activeWorkspace?.localPath,
    activeWorkspace?.label,
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
      reconnectAttempt,
    }),
    [rpc, connectionStatus, reconnectAttempt],
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
