import TOC from "./TOC";
import { useTOCContext } from "@/contexts/TOCContext";
import { usePageManager } from "@/contexts/PageManagerContext";
import { useAppNavigation } from "@/contexts/AppNavigationContext";
import WorkspaceSelector from "./WorkspaceSelector";

export default function Sidebar() {
  const { openPage } = useAppNavigation();
  const { createPage, deletePage } = usePageManager();
  const { toc, loadTOC } = useTOCContext();

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
      <div className="p-1">
        <WorkspaceSelector />
      </div>

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
