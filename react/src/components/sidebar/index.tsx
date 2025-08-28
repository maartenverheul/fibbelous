import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";

export default function Sidebar() {
  const navigate = useNavigate();
  const { workspaces, selectedWorkspaceId, switchWorkspace } = useWorkspaceContext();

  function changeWorkspace(id: string) {
    if (id === "$manage") navigate("/settings/workspaces");
    else {
      const target = workspaces.find((w) => w.id === id);
      switchWorkspace(id);
      navigate(`/${target?.slug}`);
    }
  }

  return (
    <div className="bg-slate-800 h-full w-full">
      <Select value={selectedWorkspaceId} onValueChange={changeWorkspace}>
        <SelectTrigger className="text-white rounded-none border-0 border-b select-none w-full text-center mx-auto text-lg !h-12">
          <SelectValue
            placeholder="Select an option"
            className="text-center mx-auto"
          />
        </SelectTrigger>
        <SelectContent>
          {workspaces.map((workspace) => (
            <SelectItem key={workspace.id} value={workspace.id}>
              {workspace.icon} {workspace.title}
            </SelectItem>
          ))}
          <SelectItem value="$manage" className="font-bold">
            Manage
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
