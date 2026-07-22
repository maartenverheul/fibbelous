import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  WorkspaceInfo,
} from "../types/workspace";
import { createLocalRpcClient, createRpcClient } from "./rpc";
import { openLocalWorkspace } from "./tauri";

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

export async function checkServerHealth(
  host: string,
  port: number,
): Promise<void> {
  const response = await fetch(`http://${host}:${port}/health`);
  if (!response.ok) {
    await failResponse(response);
  }
}

export async function fetchWorkspaces(
  host: string,
  port: number,
): Promise<WorkspaceInfo[]> {
  const response = await fetch(`http://${host}:${port}/workspaces`);
  if (!response.ok) {
    await failResponse(response);
  }
  return response.json() as Promise<WorkspaceInfo[]>;
}

export async function remoteWorkspaceExists(
  host: string,
  port: number,
  workspaceId: string,
): Promise<boolean> {
  const workspaces = await fetchWorkspaces(host, port);
  return workspaces.some((workspace) => workspace.id === workspaceId);
}

export async function createWorkspace(
  host: string,
  port: number,
  input: CreateWorkspaceInput,
): Promise<WorkspaceInfo> {
  const response = await fetch(`http://${host}:${port}/workspaces`, {
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
  host: string,
  port: number,
  workspaceId: string,
  input: UpdateWorkspaceInput,
): Promise<WorkspaceInfo> {
  const response = await fetch(
    `http://${host}:${port}/workspaces/${workspaceId}`,
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
  host: string,
  port: number,
  workspaceId: string,
): string {
  return `ws://${host}:${port}/${workspaceId}`;
}

export async function verifySavedWorkspaceConnection(
  host: string,
  port: number,
  workspaceId: string,
): Promise<void> {
  await checkServerHealth(host, port);
  const remoteWorkspaces = await fetchWorkspaces(host, port);
  if (!remoteWorkspaces.some((workspace) => workspace.id === workspaceId)) {
    throw new ApiError(404, "Workspace not found");
  }

  const client = createRpcClient(workspaceWsUrl(host, port, workspaceId));
  try {
    await client.call("ping");
  } finally {
    client.close();
  }
}

export async function verifyLocalWorkspaceConnection(
  localPath: string,
  workspaceId: string,
): Promise<void> {
  const info = await openLocalWorkspace(localPath);
  if (info.id !== workspaceId) {
    throw new ApiError(404, "Workspace not found");
  }

  const client = createLocalRpcClient(workspaceId);
  try {
    await client.call("ping");
  } finally {
    client.close();
  }
}

export function isWorkspaceNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
