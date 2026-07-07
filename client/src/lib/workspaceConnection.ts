import type { SavedWorkspace } from "../types/workspace";
import type { RpcClient } from "./rpc";

export type WorkspaceConnectionKey = string;

export function buildWorkspaceConnectionKey(
  workspace: Pick<SavedWorkspace, "serverHost" | "serverPort" | "workspaceId">,
): WorkspaceConnectionKey {
  return `${workspace.serverHost}:${workspace.serverPort}:${workspace.workspaceId}`;
}

type PooledConnection = {
  key: WorkspaceConnectionKey;
  client: RpcClient;
};

let pooledConnection: PooledConnection | null = null;
let connectPromise: Promise<RpcClient> | null = null;
let connectPromiseKey: WorkspaceConnectionKey | null = null;

export function getPooledConnection(
  key: WorkspaceConnectionKey,
): RpcClient | null {
  if (pooledConnection?.key !== key) return null;
  if (!pooledConnection.client.isOpen()) return null;
  return pooledConnection.client;
}

export function closePooledConnection() {
  pooledConnection?.client.close();
  pooledConnection = null;
  connectPromise = null;
  connectPromiseKey = null;
}

export async function openPooledConnection(
  key: WorkspaceConnectionKey,
  open: () => Promise<RpcClient>,
): Promise<RpcClient> {
  const existing = getPooledConnection(key);
  if (existing) return existing;

  if (connectPromise && connectPromiseKey === key) {
    return connectPromise;
  }

  if (pooledConnection && pooledConnection.key !== key) {
    pooledConnection.client.close();
    pooledConnection = null;
  }

  connectPromiseKey = key;
  connectPromise = open()
    .then((client) => {
      pooledConnection = { key, client };
      connectPromise = null;
      connectPromiseKey = null;
      return client;
    })
    .catch((error) => {
      connectPromise = null;
      connectPromiseKey = null;
      throw error;
    });

  return connectPromise;
}
