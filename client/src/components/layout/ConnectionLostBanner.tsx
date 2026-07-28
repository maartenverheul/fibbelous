import { useWorkspaceConnection } from "../../context/workspace/WorkspaceConnectionProvider";
import { cn } from "../../lib/utils";

export function ConnectionLostBanner() {
  const { connectionStatus } = useWorkspaceConnection();

  if (connectionStatus !== "disconnected") {
    return null;
  }

  return (
    <div
      role="alert"
      className={cn(
        "flex shrink-0 items-center justify-center gap-2 border-b border-red-800/30",
        "bg-red-600 px-4 py-2.5 text-center text-sm font-medium text-white",
        "dark:border-red-900/50 dark:bg-red-950 dark:text-red-50",
      )}
    >
      <span>Connection lost. Reconnecting…</span>
    </div>
  );
}
