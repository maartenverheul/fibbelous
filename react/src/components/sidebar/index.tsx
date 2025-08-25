import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState } from "react";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useLocation, useNavigate } from "react-router";

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { workspaces } = useWorkspaceContext();
  // Extract workspaceId from the current URL
  const match = location.pathname.match(/^\/(\w[\w\s-]*)/);
  const initialWorkspace =
    match && workspaces.some((w) => w.id === match[1])
      ? match[1]
      : workspaces[0].id;
  const [selectedWorkspace, setSelectedWorkspace] = useState(initialWorkspace);

  useEffect(() => {
    // Update selectedWorkspace if URL changes
    const match = location.pathname.match(/^\/(\w[\w\s-]*)/);
    if (match && workspaces.some((w) => w.id === match[1])) {
      setSelectedWorkspace(match[1]);
    }
  }, [location.pathname]);

  function changeWorkspace(id: string) {
    if (id === "$manage") navigate("/settings/workspaces");
    else {
      setSelectedWorkspace(id);
      navigate(`/${id}`);
    }
  }

  return (
    <div className="bg-slate-800 h-full w-full">
      <Select value={selectedWorkspace} onValueChange={changeWorkspace}>
        <SelectTrigger className="text-white rounded-none border-0 border-b select-none w-full text-center mx-auto text-lg !h-12">
          <SelectValue
            placeholder="Select an option"
            className="text-center mx-auto"
          />
        </SelectTrigger>
        <SelectContent>
          {workspaces.map((workspace) => (
            <SelectItem key={workspace.id} value={workspace.id}>
              {workspace.icon} {workspace.name}
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
