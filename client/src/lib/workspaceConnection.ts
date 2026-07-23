import type { SavedWorkspace } from "../types/workspace";
import type { RpcClient } from "./rpc";

export type WorkspaceConnectionKey = string;

export function buildWorkspaceConnectionKey(
  workspace: Pick<
    SavedWorkspace,
    "serverUrl" | "workspaceId" | "localPath"
  >,
): WorkspaceConnectionKey {
  if (workspace.localPath) {
    return `local:${workspace.localPath}`;
  }
  return `${workspace.serverUrl}:${workspace.workspaceId}`;
}

type PooledConnection = {
  key: WorkspaceConnectionKey;
  client: RpcClient;
};

let pooledConnection: PooledConnection | null = null;
let connectPromise: Promise<RpcClient> | null = null;
let connectPromiseKey: WorkspaceConnectionKey | null = null;
let connectGeneration = 0;

function clearDeadPooledConnection() {
  if (pooledConnection && !pooledConnection.client.isOpen()) {
    pooledConnection = null;
  }
}

export function getPooledConnection(
  key: WorkspaceConnectionKey,
): RpcClient | null {
  clearDeadPooledConnection();
  if (pooledConnection?.key !== key) return null;
  return pooledConnection.client;
}

export function closePooledConnection() {
  connectGeneration += 1;
  pooledConnection?.client.close();
  pooledConnection = null;
  connectPromise = null;
  connectPromiseKey = null;
}

/**
 * Returns the single shared workspace RPC client for `key`.
 * Reuses an open connection when possible; otherwise closes any other
 * connection and opens a new one. Never keeps more than one socket alive.
 */
export async function openPooledConnection(
  key: WorkspaceConnectionKey,
  open: () => Promise<RpcClient>,
): Promise<RpcClient> {
  const existing = getPooledConnection(key);
  if (existing) return existing;

  if (connectPromise && connectPromiseKey === key) {
    return connectPromise;
  }

  const generation = ++connectGeneration;

  if (pooledConnection) {
    pooledConnection.client.close();
    pooledConnection = null;
  }

  connectPromiseKey = key;
  connectPromise = (async () => {
    const client = await open();
    if (generation !== connectGeneration) {
      client.close();
      throw new Error("Workspace connection superseded");
    }
    pooledConnection = { key, client };
    return client;
  })()
    .catch((error) => {
      if (generation === connectGeneration) {
        pooledConnection = null;
      }
      throw error;
    })
    .finally(() => {
      if (generation === connectGeneration) {
        connectPromise = null;
        connectPromiseKey = null;
      }
    });

  return connectPromise;
}
