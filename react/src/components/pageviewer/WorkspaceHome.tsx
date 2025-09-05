import { useAppNavigation } from "@/contexts/AppNavigationContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { SettingsIcon } from "lucide-react";
import { Link } from "react-router";

export default function WorkspaceHome() {
  const workspace = useWorkspace();
  const appNavigation = useAppNavigation();

  if (!workspace) return null;

  return (
    <div className="w-full h-full bg-gray-700 p-10">
      <div className="flex items-center gap-4 rounded bg-gray-600 p-2 pr-4 mb-4">
        <div className="text-4xl rounded-md hover:bg-gray-500 cursor-pointer w-14 h-14 flex items-center justify-center">{workspace.info?.icon}</div>
        <h1 className="text-white text-4xl font-bold">{workspace.info?.title}</h1>
        <Link to={appNavigation.workspaceSettingsLink()} className="ml-auto text-gray-400 hover:text-gray-200 hover:bg-gray-500 rounded p-2 cursor-pointer">
          <SettingsIcon />
        </Link>
      </div>
      <h2 className="text-white text-xl font-bold">Recent Activity</h2>
    </div>
  );
}