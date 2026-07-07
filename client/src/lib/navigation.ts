export type WorkspaceNotice = {
  kind: "missing" | "connectionFailed";
  label: string;
};

export type LandingLocationState = {
  openWorkspaceManager?: boolean;
  notice?: WorkspaceNotice;
};

export function workspaceManagerRedirectState(
  notice: WorkspaceNotice,
): LandingLocationState {
  return {
    openWorkspaceManager: true,
    notice,
  };
}

export function shouldOpenWorkspaceManager(
  state: unknown,
): state is LandingLocationState {
  return (
    typeof state === "object" &&
    state !== null &&
    "openWorkspaceManager" in state &&
    (state as LandingLocationState).openWorkspaceManager === true
  );
}

export function workspaceNoticeMessage(notice: WorkspaceNotice): string {
  if (notice.kind === "missing") {
    return `"${notice.label}" no longer exists on the server. The bookmark was removed.`;
  }
  return `Could not connect to "${notice.label}". Choose another workspace below.`;
}
