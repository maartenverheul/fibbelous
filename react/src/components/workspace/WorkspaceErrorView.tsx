import { TriangleAlert, RefreshCw } from "lucide-react";
import { Link } from "react-router";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useWorkspaceManager } from "@/contexts/WorkspaceManagerContext";
import { useAppNavigation } from "@/contexts/AppNavigationContext";

export default function WorkspaceErrorView() {
  const workspace = useWorkspace();
  const manager = useWorkspaceManager();
  const appNavigation = useAppNavigation();
  if (!workspace) return null;
  const errorState = workspace.connectionState.success === false ? workspace.connectionState : undefined;
  if (!errorState) return null;

  return (
    <div className="w-full h-full bg-gray-800 flex flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex flex-col items-center gap-4 max-w-md">
        <TriangleAlert className="w-16 h-16 text-red-400" />
        <h1 className="text-3xl font-bold text-red-300">Workspace Unavailable</h1>
        <p className="text-sm text-red-200/80 leading-relaxed">
          We couldn't load the workspace <span className="font-semibold">{workspace.info.title}</span>.{" "}
          <br />Reason: {errorState.error || "Unknown connection error"}.
        </p>
        <div className="flex gap-3 mt-2">
          <button
            onClick={() => manager.forceRefreshRemote()}
            className="inline-flex cursor-pointer items-center gap-2 px-4 py-2 rounded bg-red-600/70 hover:bg-red-600 text-white text-sm font-medium shadow transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
          <Link
            to={appNavigation.settingsLink("workspaces")}
            className="inline-flex cursor-pointer items-center gap-2 px-4 py-2 rounded bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium shadow transition-colors"
          >
            Manage Workspaces
          </Link>
        </div>
      </div>
    </div>
  );
}
