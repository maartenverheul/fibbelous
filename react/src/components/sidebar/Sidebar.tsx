import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router";
import { useWorkspaceManager } from "@/contexts/WorkspaceManagerContext";
import TOC from "./TOC";
import { useTOCContext } from "@/contexts/TOCContext";
import { usePageManager } from "@/contexts/PageManagerContext";
import { useAppNavigation } from "@/contexts/AppNavigationContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export default function Sidebar() {
  const navigate = useNavigate();
  const {
    list: workspaces,
    selectedWorkspaceId,
    switchWorkspace,
  } = useWorkspaceManager();
  const workspace = useWorkspace();
  const { openPage } = useAppNavigation();
  const { createPage, deletePage } = usePageManager();
  const { toc, loadTOC } = useTOCContext();

  function changeWorkspace(id: string) {
    if (id === "$manage") navigate("#settings/workspaces");
    else {
      const target = workspaces.find((w) => w.id === id);
      switchWorkspace(id);
      navigate(`/${target?.slug}`);
    }
  }

  function handlePageClick(id: string) {
    openPage(id);
  }

  function handlePageDelete(id: string) {
    deletePage(id);
  }

  function handleCreatePage(parent?: string | undefined): void {
    createPage(parent);
  }

  return (
    <div className="bg-gray-800 h-full w-full">
      <Select value={workspace?.id} onValueChange={changeWorkspace}>
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

      <TOC
        className="mt-2"
        items={toc}
        onPageClick={handlePageClick}
        onPageDelete={handlePageDelete}
        onNewPage={handleCreatePage}
      />
    </div>
  );
}
