import {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { CommandList, EventList } from "@/models/commands";
import { Workspace } from "@/models";
import { IS_APP } from "@/checks";
import { invoke } from "@tauri-apps/api/tauri";
import { toast } from "sonner";

// Result type can be imported later if needed

export interface ServerContextValue {
  status: "idle" | "connecting" | "open" | "closed" | "error";
  connected: boolean;
  lastError?: string;
  dispatch<C extends keyof CommandList>(
    type: C,
    payload: CommandList[C]["payload"]
  ): Promise<CommandList[C]["returnType"]>;
  subscribe<C extends keyof EventList>(
    event: C,
    handler: (payload: EventList[C]) => void
  ): () => void;
}

const TauriServerContext: ServerContextValue = {
  status: "idle",
  connected: false,
  lastError: undefined,
  dispatch: async (type, _payload) => {
    const result = await invoke("invoke_command", { command: { type: "getSavedWorkspaces", ..._payload } }) as any;
    if (result.type == "error") throw new Error(result.payload.message);
  },
  subscribe: () => {
    return () => { };
  }
}

export const ServerContext = createContext<ServerContextValue | undefined>(TauriServerContext);

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
  const listeners = useRef(new Map<string, Set<(payload: any) => void>>());

  // Simple id generator
  function nextId() {
    return Math.random().toString(36).slice(2, 10);
  }

  // (Re)connect when active workspace changes
  useEffect(() => {
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch { }
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
        if (type === "error") {
          toast.error("Server error", {
            description: payload.message,
            duration: 5000,
          });
        }
        if (id && pending.current.has(id)) {
          const { resolve, reject } = pending.current.get(id)!;
          pending.current.delete(id);
          if (type === "error") reject(new Error(payload.message));
          else resolve(payload);
          return;
        }
        // Non-response message: treat 'type' as event name and dispatch to listeners
        if (!id && type && listeners.current.has(type)) {
          console.debug("Event received:", type, payload);
          for (const handler of listeners.current.get(type)!) {
            try {
              handler(payload);
            } catch (e) {
              console.warn("Listener error", e);
            }
          }
        }
      } catch (e) {
        console.warn("Server message parse failed", e);
      }
    };
    return () => {
      try {
        ws.close();
      } catch { }
    };
  }, [workspace?.info?.id]);

  async function dispatch<C extends keyof CommandList>(
    type: C,
    payload: CommandList[C]["payload"]
  ): Promise<CommandList[C]["returnType"]> {
    if (IS_APP) {
      return await invoke(type, payload);
    } else {
      if (
        !socketRef.current ||
        socketRef.current.readyState !== WebSocket.OPEN
      ) {
        throw new Error("Socket not open");
      }
      const id = nextId();
      const message = {
        id,
        type: type,
        payload: payload ?? {},
      };
      const p = new Promise<CommandList[C]["returnType"]>((resolve, reject) => {
        pending.current.set(id, { resolve, reject });
        setTimeout(() => {
          if (pending.current.has(id)) {
            pending.current.delete(id);
            reject(new Error("Timeout"));
          }
        }, 15000);
      });
      socketRef.current.send(JSON.stringify(message));
      return p;
    }
  }

  function subscribe<C extends keyof EventList>(
    event: C,
    handler: (payload: EventList[C]) => void
  ) {
    console.debug("Subscribing to event:", event);
    if (!listeners.current.has(event)) {
      listeners.current.set(event, new Set());
    }
    listeners.current.get(event)!.add(handler as any);
    return () => {
      console.debug("Unsubscribing from event: ", event);
      const set = listeners.current.get(event);
      if (!set) return;
      set.delete(handler as any);
      if (set.size === 0) listeners.current.delete(event);
    };
  }

  return (
    <ServerContext.Provider
      value={{
        status,
        connected: status === "open",
        lastError,
        dispatch,
        subscribe,
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
