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

export default function WorkspaceSelector() {
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
      <SelectTrigger className="text-white bg-gray-700 border !border-gray-900 rounded-sm select-none w-full text-center mx-auto text-lg !h-12">
        <SelectValue
          placeholder="Select an option"
          className="text-center mx-auto"
        />
      </SelectTrigger>
      <SelectContent>
        {workspaces.map((workspace) => (
          <Link to={`/${workspace.slug}`} key={workspace.id}>
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
