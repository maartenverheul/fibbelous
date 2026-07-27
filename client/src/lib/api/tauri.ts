import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { WorkspaceInfo } from "./workspace";

export { isTauri };

/** Open a URL in the system browser (Tauri) or a new tab (web). */
export async function openExternalUrl(url: string): Promise<void> {
  if (isTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

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

export async function cloneLocalWorkspace(
  url: string,
  parentPath: string,
): Promise<WorkspaceInfo & { path: string }> {
  return invoke<WorkspaceInfo & { path: string }>("clone_local_workspace", {
    url,
    parentPath,
  });
}

export async function pickCloneParentFolder(): Promise<string | null> {
  if (!isTauri()) return null;

  const selected = await open({
    directory: true,
    multiple: false,
    title: "Choose folder for cloned workspace",
  });

  if (typeof selected === "string" && selected.length > 0) {
    return selected;
  }

  return null;
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
