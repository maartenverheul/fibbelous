import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "react-router";
import { useWorkspaceManager } from "@/contexts/WorkspaceManagerContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAppNavigation } from "@/contexts/AppNavigationContext";
import { TriangleAlert } from "lucide-react";

export default function WorkspaceSelector() {
  const appNavigation = useAppNavigation();
  const { workspaces } = useWorkspaceManager();
  const workspace = useWorkspace();
  const hasError =
    !!workspace && workspace.connectionState.success === false;

  function changeWorkspace(id: string) {
    if (id === "$manage")
      appNavigation.navigate(appNavigation.settingsLink("workspaces", null));
    else {
      const target = workspaces.find((w) => w.info.id === id);
      appNavigation.navigate(appNavigation.workspaceHomeLink(target?.info));
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Select value={workspace?.info?.id} onValueChange={changeWorkspace}>
        <SelectTrigger
          className={
            "relative cursor-pointer border rounded-sm select-none w-full text-center mx-auto text-lg !h-12 transition-colors " +
            (hasError
              ? "border-red-600 bg-red-900/50 text-red-300 !focus:ring-red-500"
              : "border-gray-900 bg-gray-700 text-white")
          }
        >
          <SelectValue
            placeholder="No workspace selected"
            className="text-center mx-auto"
          />
        </SelectTrigger>
        <SelectContent>
          {workspaces.map((w) => {
            const itemError = w.connectionState.success === false;
            const iconEl = itemError ? (
              <TriangleAlert className="w-4 h-4 text-red-300" />
            ) : (
              <span className="shrink-0">{w.info.icon}</span>
            );
            return (
              <Link
                to={appNavigation.workspaceHomeLink(w.info)}
                key={w.info.id}
              >
                <SelectItem
                  key={w.info.id}
                  value={w.info.id}
                  className={
                    "cursor-pointer flex gap-2 items-center " +
                    (itemError ? "!text-red-500" : "")
                  }
                >
                  {iconEl}
                  <span className="truncate text-left flex-1">
                    {w.info.title}
                  </span>
                </SelectItem>
              </Link>
            );
          })}
          <Link to={appNavigation.settingsLink("workspaces", null)} key="$manage">
            <SelectItem value="$manage" className="font-bold cursor-pointer">
              Manage
            </SelectItem>
          </Link>
        </SelectContent>
      </Select>
    </div>
  );
}
