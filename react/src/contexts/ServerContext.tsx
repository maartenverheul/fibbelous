import {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Command } from "@/models/commands";
import { Workspace } from "@/models";
import { IS_APP } from "@/checks";
import { invoke } from "@tauri-apps/api/tauri";

// Result type can be imported later if needed

export interface ServerContextValue {
  status: "idle" | "connecting" | "open" | "closed" | "error";
  connected: boolean;
  lastError?: string;
  dispatch<T = unknown>(command: Command): Promise<T>;
}

export const ServerContext = createContext<ServerContextValue | undefined>(
  undefined
);

export function ServerProvider({
  children,
  workspace,
}: {
  children: ReactNode;
  workspace?: Workspace;
}) {
  const socketRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ServerContextValue["status"]>("idle");
  const [lastError, setLastError] = useState<string | undefined>();
  const pending = useRef(
    new Map<string, { resolve: (v: any) => void; reject: (e: any) => void }>()
  );

  // Simple id generator
  function nextId() {
    return Math.random().toString(36).slice(2, 10);
  }

  // (Re)connect when active workspace changes
  useEffect(() => {
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch {}
      socketRef.current = null;
    }
    if (!workspace?.info?.id) {
      setStatus("idle");
      return;
    }

    // If not remote, don't connect socket
    if (workspace.connection.url === undefined) return;

    setStatus("connecting");
    setLastError(undefined);
    const url = new URL(workspace.connection.url);
    const base = `ws://${url.host}/ws`;
    const wsUrl = `${base}?workspace=${encodeURIComponent(workspace.info.id)}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;
    ws.onopen = () => {
      setStatus("open");
      console.debug("Connected to websocket");
    };
    ws.onerror = () => {
      setLastError("socket error");
      setStatus("error");
    };
    ws.onclose = () => {
      setStatus("closed");
      console.debug("Disconnected from websocket");
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const { id, payload, type } = msg;
        if (id && pending.current.has(id)) {
          const { resolve, reject } = pending.current.get(id)!;
          pending.current.delete(id);
          if (type === "error") reject(new Error(payload.message));
          else resolve(payload);
        }
      } catch (e) {
        console.warn("Server message parse failed", e);
      }
    };
    return () => {
      try {
        ws.close();
      } catch {}
    };
  }, [workspace?.info?.id]);

  async function dispatch<T = unknown>(command: Command): Promise<T> {
    if (IS_APP) {
      return await invoke(command.type, command.payload);
    } else {
      if (
        !socketRef.current ||
        socketRef.current.readyState !== WebSocket.OPEN
      ) {
        throw new Error("Socket not open");
      }
      const id = nextId();
      const payload = {
        id,
        type: command.type,
        payload: command.payload ?? {},
      };
      const p = new Promise<T>((resolve, reject) => {
        pending.current.set(id, { resolve, reject });
        setTimeout(() => {
          if (pending.current.has(id)) {
            pending.current.delete(id);
            reject(new Error("Timeout"));
          }
        }, 15000);
      });
      socketRef.current.send(JSON.stringify(payload));
      return p;
    }
  }

  return (
    <ServerContext.Provider
      value={{
        status,
        connected: status === "open",
        lastError,
        dispatch,
      }}
    >
      {children}
    </ServerContext.Provider>
  );
}

export function useServer() {
  const ctx = useContext(ServerContext);
  if (!ctx) console.warn("useServer must be used within ServerProvider");
  return ctx!;
}
