import type { WorkspaceInfo } from "../types/workspace";

export async function fetchWorkspaces(
  host: string,
  port: number,
): Promise<WorkspaceInfo[]> {
  const response = await fetch(`http://${host}:${port}/workspaces`);
  if (!response.ok) {
    throw new Error(`Failed to fetch workspaces (${response.status})`);
  }
  return response.json() as Promise<WorkspaceInfo[]>;
}

export function workspaceWsUrl(
  host: string,
  port: number,
  workspaceId: string,
): string {
  return `ws://${host}:${port}/${workspaceId}`;
}
