import { Workspace, WorkspaceInfo } from "@/models";
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAppNavigation } from "./AppNavigationContext";
import { useWorkspaceManager } from "./WorkspaceManagerContext";

/** Value exposed by the single WorkspaceContext */
export interface WorkspaceContextValue {
  info?: WorkspaceInfo;
  status: "idle" | "connecting" | "open" | "closed" | "error";
  send: (data: unknown) => boolean; // convenience sender
  lastError?: string;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { urlWorkspaceSlug } = useAppNavigation();
  const workspaceManager = useWorkspaceManager();

  const workspace = useMemo<Workspace | undefined>(() => {
    if (!urlWorkspaceSlug) return undefined;
    return workspaceManager.getWorkspaceBySlug(urlWorkspaceSlug);
  }, [urlWorkspaceSlug, workspaceManager]);

  const socketRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<WorkspaceContextValue["status"]>("idle");
  const [lastError, setLastError] = useState<string | undefined>(undefined);
  const currentWsIdRef = useRef<string | undefined>(undefined);

  // Minimal (re)connect logic when workspace changes.
  useEffect(() => {
    // Close previous
    if (socketRef.current) {
      try { socketRef.current.close(1000, "workspace change"); } catch { }
      socketRef.current = null;
      setStatus("closed");
    }

    if (!workspace) {
      currentWsIdRef.current = undefined;
      setStatus("idle");
      return;
    }

    currentWsIdRef.current = workspace.info.id;
    setStatus("connecting");
    setLastError(undefined);

    const base = import.meta.env.VITE_SERVER_WS_URL ?? "ws://localhost:3001/ws";
    const wsUrl = `${base}?workspace=${encodeURIComponent(workspace.info.id)}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      if (currentWsIdRef.current !== workspace.info.id) return;
      setStatus("open");
    };
    ws.onmessage = () => {
      // For now ignore; consumer can extend later.
    };
    ws.onerror = () => {
      setLastError("socket error");
      setStatus("error");
    };
    ws.onclose = () => {
      if (currentWsIdRef.current === workspace.info.id) {
        setStatus("closed");
      }
    };

    return () => {
      if (socketRef.current === ws) {
        try { ws.close(); } catch { }
        socketRef.current = null;
      }
    };
  }, [workspace?.info.id]);

  const send = (data: unknown): boolean => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(typeof data === "string" ? data : JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  };

  // Heartbeat ping every 60s to keep connection alive
  useEffect(() => {
    if (status !== "open") return;
    const id = setInterval(() => {
      const ws = socketRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: "ping" })); } catch { /* ignore */ }
      }
    }, 60 * 1000);
    return () => clearInterval(id);
  }, [status]);

  return <WorkspaceContext.Provider value={{
    info: workspace?.info,
    status,
    send,
    lastError,
  }}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
