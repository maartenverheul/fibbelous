import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import PageList from "./PageList";
import { usePageContext } from "@/contexts/PageContext";

export default function Sidebar() {
  const navigate = useNavigate();
  const { workspaces, selectedWorkspaceId, switchWorkspace } =
    useWorkspaceContext();
  const { pages, selectPage, deletePage, createPage } = usePageContext();

  function changeWorkspace(id: string) {
    if (id === "$manage") navigate("/settings/workspaces");
    else {
      const target = workspaces.find((w) => w.id === id);
      switchWorkspace(id);
      navigate(`/${target?.slug}`);
    }
  }

  function handlePageClick(id: string) {
    selectPage(id);
  }

  function handlePageDelete(id: string) {
    deletePage(id);
  }

  function handleCreatePage(parent?: string | undefined): void {
    createPage(parent);
  }

  return (
    <div className="bg-gray-800 h-full w-full">
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

      <PageList
        className="mt-2"
        pages={pages}
        onPageClick={handlePageClick}
        onPageDelete={handlePageDelete}
        onNewPage={handleCreatePage}
      />
    </div>
  );
}
