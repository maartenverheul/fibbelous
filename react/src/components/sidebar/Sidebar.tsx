import TOC from "./TOC";
import { usePageManager } from "@/contexts/PageManagerContext";
import { useAppNavigation } from "@/contexts/AppNavigationContext";
import WorkspaceSelector from "./WorkspaceSelector";
import { TOCItem } from "@/models";

export default function Sidebar() {
  const appNavigation = useAppNavigation();
  const pageManager = usePageManager();

  function handlePageClick(item: TOCItem) {
    appNavigation.openTOCItem(item);
  }

  function handlePageDelete(id: string) {
    pageManager.deletePage(id);
  }

  function handleCreatePage(parent?: string | undefined): void {
    pageManager.createPage(parent, true);
  }

  return (
    <div className="bg-gray-800 h-full w-full">
      <div className="p-1">
        <WorkspaceSelector />
      </div>

      <TOC
        className="mt-2"
        onPageClick={handlePageClick}
        onPageDelete={handlePageDelete}
        onNewPage={handleCreatePage}
      />
    </div>
  );
}
