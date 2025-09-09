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

export default function WorkspaceSelector() {
  const appNavigation = useAppNavigation();
  const { workspaces } = useWorkspaceManager();
  const workspace = useWorkspace();

  function changeWorkspace(id: string) {
    if (id === "$manage")
      appNavigation.navigate(appNavigation.settingsLink("workspaces", null));
    else {
      const target = workspaces.find((w) => w.info.id === id);
      appNavigation.navigate(appNavigation.workspaceHomeLink(target?.info));
      // navigate(`/${target?.slug}`);
    }
  }

  return (
    <Select value={workspace?.info?.id} onValueChange={changeWorkspace}>
      <SelectTrigger className="relative text-white cursor-pointer bg-gray-700 border !border-gray-900 rounded-sm select-none w-full text-center mx-auto text-lg !h-12">
        <SelectValue
          placeholder="No workspace selected"
          className="text-center mx-auto"
        />
      </SelectTrigger>
      <SelectContent>
        {workspaces.map((workspace) => (
          <Link
            to={appNavigation.workspaceHomeLink(workspace.info)}
            key={workspace.info.id}
          >
            <SelectItem
              key={workspace.info.id}
              value={workspace.info.id}
              className="cursor-pointer"
            >
              {workspace.info.icon} {workspace.info.title}
            </SelectItem>
          </Link>
        ))}
        <Link to={appNavigation.settingsLink("workspaces", null)} key="$manage">
          <SelectItem value="$manage" className="font-bold cursor-pointer">
            Manage
          </SelectItem>
        </Link>
      </SelectContent>
    </Select>
  );
}
