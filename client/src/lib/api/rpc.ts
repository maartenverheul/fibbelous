import { invoke } from "@tauri-apps/api/core";

type JsonRpcResponse<T> = {
  jsonrpc: "2.0";
  id: string | number;
  result?: T;
  error?: { code: number; message: string };
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export class RpcConnectionClosedError extends Error {
  constructor() {
    super("WebSocket closed");
    this.name = "RpcConnectionClosedError";
  }
}

export function isIgnorableRpcError(error: unknown): boolean {
  if (error instanceof RpcConnectionClosedError) return true;
  if (error instanceof Error) {
    return (
      error.message === "WebSocket closed" ||
      error.message === "WebSocket connection failed"
    );
  }
  return false;
}

export type RpcClient = {
  call<T>(method: string, params?: unknown): Promise<T>;
  close: () => void;
  isOpen(): boolean;
};

export function createRpcClient(wsUrl: string): RpcClient {
  const socket = new WebSocket(wsUrl);
  const pending = new Map<string, PendingRequest>();
  let nextId = 0;

  const ready = new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener(
      "error",
      () => reject(new Error("WebSocket connection failed")),
      { once: true },
    );
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data as string) as JsonRpcResponse<unknown>;
    if (message.id === undefined || message.id === null) return;

    const request = pending.get(String(message.id));
    if (!request) return;

    pending.delete(String(message.id));

    if (message.error) {
      request.reject(new Error(message.error.message));
      return;
    }

    request.resolve(message.result);
  });

  socket.addEventListener("close", () => {
    for (const request of pending.values()) {
      request.reject(new RpcConnectionClosedError());
    }
    pending.clear();
  });

  return {
    async call<T>(method: string, params?: unknown): Promise<T> {
      await ready;

      const id = String(++nextId);
      const payload = {
        jsonrpc: "2.0",
        id,
        method,
        params: params ?? [],
      };

      return new Promise<T>((resolve, reject) => {
        pending.set(id, {
          resolve: (value) => resolve(value as T),
          reject,
        });
        socket.send(JSON.stringify(payload));
      });
    },
    close() {
      socket.close();
    },
    isOpen() {
      return socket.readyState === WebSocket.OPEN;
    },
  };
}

export function createLocalRpcClient(workspaceId: string): RpcClient {
  let open = true;

  return {
    async call<T>(method: string, params?: unknown): Promise<T> {
      if (!open) {
        throw new RpcConnectionClosedError();
      }
      try {
        return await invoke<T>("local_workspace_rpc", {
          workspaceId,
          method,
          params: params ?? null,
        });
      } catch (error) {
        if (error instanceof Error) throw error;
        if (typeof error === "string" && error.trim()) {
          throw new Error(error);
        }
        if (error && typeof error === "object") {
          const record = error as Record<string, unknown>;
          for (const key of ["message", "error", "msg"] as const) {
            const value = record[key];
            if (typeof value === "string" && value.trim()) {
              throw new Error(value);
            }
          }
        }
        throw new Error(String(error ?? "RPC call failed"));
      }
    },
    close() {
      open = false;
    },
    isOpen() {
      return open;
    },
  };
}
