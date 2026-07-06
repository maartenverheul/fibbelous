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
    rootLoaded: rootPages !== undefined,
    rootLoading: rootPages === undefined && !rootError,
  };
}

export { ROOT_PAGES_DIR };
