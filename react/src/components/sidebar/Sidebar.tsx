import TOC from "./TOC";
import { usePageManager } from "@/contexts/PageManagerContext";
import { useAppNavigation } from "@/contexts/AppNavigationContext";
import WorkspaceSelector from "./WorkspaceSelector";
import { TOCItem } from "@/models";
import { useTOCContext } from "@/contexts/TOCContext";

export default function Sidebar() {
  const appNavigation = useAppNavigation();
  const pageManager = usePageManager();
  const { toc, loadTOC } = useTOCContext();

  function handlePageClick(item: TOCItem) {
    appNavigation.openPage(item);
  }

  function handlePageDelete(id: string) {
    pageManager.deletePage(id);
  }

  function handleCreatePage(parent?: string | undefined): void {
    pageManager.createPage(parent);
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
