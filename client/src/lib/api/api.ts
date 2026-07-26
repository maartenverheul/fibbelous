import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  WorkspaceInfo,
} from "./workspace";
import { createLocalRpcClient, createRpcClient, type RpcClient } from "./rpc";
import { openLocalWorkspace } from "./tauri";
import {
  buildWorkspaceConnectionKey,
  openPooledConnection,
} from "./workspaceConnection";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // Fall back to status-only message.
  }

  return `Request failed (${response.status})`;
}

async function failResponse(response: Response): Promise<never> {
  throw new ApiError(response.status, await readErrorMessage(response));
}

function httpUrl(serverUrl: string, path: string): string {
  return new URL(path, `${serverUrl.replace(/\/$/, "")}/`).toString();
}

export async function checkServerHealth(serverUrl: string): Promise<void> {
  const response = await fetch(httpUrl(serverUrl, "health"));
  if (!response.ok) {
    await failResponse(response);
  }
}

export async function fetchWorkspaces(
  serverUrl: string,
): Promise<WorkspaceInfo[]> {
  const response = await fetch(httpUrl(serverUrl, "workspaces"));
  if (!response.ok) {
    await failResponse(response);
  }

  return response.json() as Promise<WorkspaceInfo[]>;
}

export async function remoteWorkspaceExists(
  serverUrl: string,

  workspaceId: string,
): Promise<boolean> {
  const workspaces = await fetchWorkspaces(serverUrl);

  return workspaces.some((workspace) => workspace.id === workspaceId);
}

export async function createWorkspace(
  serverUrl: string,

  input: CreateWorkspaceInput,
): Promise<WorkspaceInfo> {
  const response = await fetch(httpUrl(serverUrl, "workspaces"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    await failResponse(response);
  }

  return response.json() as Promise<WorkspaceInfo>;
}

export async function updateWorkspaceSettings(
  serverUrl: string,

  workspaceId: string,

  input: UpdateWorkspaceInput,
): Promise<WorkspaceInfo> {
  const response = await fetch(
    httpUrl(serverUrl, `workspaces/${workspaceId}`),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    await failResponse(response);
  }

  return response.json() as Promise<WorkspaceInfo>;
}

export function workspaceWsUrl(
  serverUrl: string,

  workspaceId: string,
): string {
  const url = new URL(serverUrl);

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/${workspaceId}`;
  url.search = "";
  url.hash = "";

  return url.toString();
}

async function openRemoteRpcClient(
  serverUrl: string,

  workspaceId: string,
): Promise<RpcClient> {
  const remoteWorkspaces = await fetchWorkspaces(serverUrl);

  if (!remoteWorkspaces.some((workspace) => workspace.id === workspaceId)) {
    throw new ApiError(404, "Workspace not found");
  }

  const rpcClient = createRpcClient(workspaceWsUrl(serverUrl, workspaceId));

  try {
    await rpcClient.call("ping");

    return rpcClient;
  } catch (error) {
    rpcClient.close();

    throw error;
  }
}

async function openLocalRpcClient(
  localPath: string,

  workspaceId: string,
): Promise<RpcClient> {
  const info = await openLocalWorkspace(localPath);

  if (info.id !== workspaceId) {
    throw new ApiError(404, "Workspace not found");
  }

  const rpcClient = createLocalRpcClient(workspaceId);

  try {
    await rpcClient.call("ping");

    return rpcClient;
  } catch (error) {
    rpcClient.close();

    throw error;
  }
}

/** Single shared remote workspace connection (reuses pool when open). */

export async function openRemoteWorkspaceConnection(
  serverUrl: string,

  workspaceId: string,
): Promise<RpcClient> {
  return openPooledConnection(
    buildWorkspaceConnectionKey({ serverUrl, workspaceId }),

    () => openRemoteRpcClient(serverUrl, workspaceId),
  );
}

/** Single shared local workspace connection (reuses pool when open). */

export async function openLocalWorkspaceConnection(
  localPath: string,

  workspaceId: string,
): Promise<RpcClient> {
  return openPooledConnection(
    buildWorkspaceConnectionKey({ localPath, serverUrl: "", workspaceId }),

    () => openLocalRpcClient(localPath, workspaceId),
  );
}

export async function verifySavedWorkspaceConnection(
  serverUrl: string,

  workspaceId: string,
): Promise<void> {
  await checkServerHealth(serverUrl);

  await openRemoteWorkspaceConnection(serverUrl, workspaceId);
}

export async function verifyLocalWorkspaceConnection(
  localPath: string,

  workspaceId: string,
): Promise<void> {
  await openLocalWorkspaceConnection(localPath, workspaceId);
}

export async function reindexLocalWorkspace(
  localPath: string,

  workspaceId: string,
): Promise<WorkspaceInfo> {
  const client = await openLocalWorkspaceConnection(localPath, workspaceId);

  return client.call<WorkspaceInfo>("reindex");
}

export async function reindexRemoteWorkspace(
  serverUrl: string,

  workspaceId: string,
): Promise<WorkspaceInfo> {
  const client = await openRemoteWorkspaceConnection(serverUrl, workspaceId);

  return client.call<WorkspaceInfo>("reindex");
}

export function isWorkspaceNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
