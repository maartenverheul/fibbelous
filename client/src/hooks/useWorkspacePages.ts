import { useWorkspace } from "../context/WorkspaceContext";
import { treeCacheKey } from "../types/page";

export function useWorkspacePages() {
  const {
    rootPages,
    rootError,
    getChildren,
    ensureChildren,
    ensurePageTreeVisible,
    findPageByKey,
    findPageById,
    getPageDetailById,
    connectionStatus,
    fetchPageById,
    fetchPageDetail,
    fetchTrashedPageDetail,
    createPage,
    createRootPage,
    updatePage,
    duplicatePage,
    trashPage,
    searchPages,
    listTrashedPages,
    restorePage,
    purgePage,
  } = useWorkspace();

  return {
    rootPages,
    rootError,
    getChildren,
    ensureChildren,
    ensurePageTreeVisible,
    findPageByKey,
    findPageById,
    getPageDetailById,
    connectionStatus,
    fetchPageById,
    fetchPageDetail,
    fetchTrashedPageDetail,
    createPage,
    createRootPage,
    updatePage,
    duplicatePage,
    trashPage,
    searchPages,
    listTrashedPages,
    restorePage,
    purgePage,
    rootLoaded: rootPages !== undefined,
    rootLoading: rootPages === undefined && !rootError,
  };
}

export { treeCacheKey };
