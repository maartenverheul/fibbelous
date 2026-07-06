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

export type RpcClient = {
  call<T>(method: string, params?: unknown): Promise<T>;
  close: () => void;
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
      request.reject(new Error("WebSocket closed"));
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
  };
}
