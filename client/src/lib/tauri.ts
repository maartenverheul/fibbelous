import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { WorkspaceInfo } from "../types/workspace";

export { isTauri };

export async function pickWorkspaceFolder(): Promise<string | null> {
  if (!isTauri()) return null;

  const selected = await open({
    directory: true,
    multiple: false,
    title: "Choose workspace folder",
  });

  if (typeof selected === "string" && selected.length > 0) {
    return selected;
  }

  return null;
}

export async function openLocalWorkspace(path: string): Promise<WorkspaceInfo> {
  return invoke<WorkspaceInfo>("open_local_workspace", { path });
}

export async function updateLocalWorkspaceSettings(
  workspaceId: string,
  input: { title?: string; slug?: string; icon?: string },
): Promise<WorkspaceInfo> {
  return invoke<WorkspaceInfo>("update_local_workspace_settings", {
    workspaceId,
    title: input.title,
    slug: input.slug,
    icon: input.icon,
  });
}
