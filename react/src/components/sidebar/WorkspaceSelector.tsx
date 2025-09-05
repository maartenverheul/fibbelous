import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link, useNavigate } from "react-router";
import { useWorkspaceManager } from "@/contexts/WorkspaceManagerContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAppNavigation } from "@/contexts/AppNavigationContext";

export default function WorkspaceSelector() {
  const appNavigation = useAppNavigation();
  const navigate = useNavigate();
  const { list: workspaces, switchWorkspace } = useWorkspaceManager();
  const workspace = useWorkspace();

  function changeWorkspace(id: string) {
    if (id === "$manage") navigate("#settings/workspaces");
    else {
      const target = workspaces.find((w) => w.id === id);
      switchWorkspace(id);
      navigate(`/${target?.slug}`);
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
          <Link to={appNavigation.workspaceHomeLink(workspace)} key={workspace.id}>
            <SelectItem
              key={workspace.id}
              value={workspace.id}
              className="cursor-pointer"
            >
              {workspace.icon} {workspace.title}
            </SelectItem>
          </Link>
        ))}
        <SelectItem value="$manage" className="font-bold cursor-pointer">
          Manage
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
