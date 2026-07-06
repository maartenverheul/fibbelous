import { useWorkspace } from "../context/WorkspaceContext";
import { ROOT_PAGES_DIR } from "../types/page";

export function useWorkspacePages() {
  const {
    rootPages,
    rootError,
    getChildren,
    ensureChildren,
    findPageByKey,
    findPageById,
    fetchPageById,
    fetchPageDetail,
    fetchTrashedPageDetail,
    createPage,
    updatePage,
    duplicatePage,
    trashPage,
    listTrashedPages,
    restorePage,
    purgePage,
  } = useWorkspace();

  return {
    rootPages,
    rootError,
    getChildren,
    ensureChildren,
    findPageByKey,
    findPageById,
    fetchPageById,
    fetchPageDetail,
    fetchTrashedPageDetail,
    createPage,
    updatePage,
    duplicatePage,
    trashPage,
    listTrashedPages,
    restorePage,
    purgePage,
    rootLoaded: rootPages !== undefined,
    rootLoading: rootPages === undefined && !rootError,
  };
}

export { ROOT_PAGES_DIR };
