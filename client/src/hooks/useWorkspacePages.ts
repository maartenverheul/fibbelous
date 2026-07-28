import { useWorkspace } from "../context/WorkspaceContext";
import { treeCacheKey } from "../lib/page/types";

export function useWorkspacePages() {
  const {
    rootPages,
    favoritePages,
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
    setPageFavorite,
    duplicatePage,
    trashPage,
    searchPages,
    listTrashedPages,
    restorePage,
    purgePage,
    draftTitlesById,
    setPageDraftTitle,
  } = useWorkspace();

  return {
    rootPages,
    favoritePages,
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
    setPageFavorite,
    duplicatePage,
    trashPage,
    searchPages,
    listTrashedPages,
    restorePage,
    purgePage,
    draftTitlesById,
    setPageDraftTitle,
    rootLoaded: rootPages !== undefined,
    rootLoading: rootPages === undefined && !rootError,
  };
}

export { treeCacheKey };
