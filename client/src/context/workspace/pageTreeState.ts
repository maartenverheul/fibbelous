import type { Dispatch, RefObject, SetStateAction } from "react";
import { isIgnorableRpcError } from "../../lib/rpc";
import {
  ROOT_PAGES_DIR,
  type WorkspacePage,
  type WorkspacePageDetail,
} from "../../types/page";

export function resetPageTree(
  setChildrenByDir: Dispatch<SetStateAction<Record<string, WorkspacePage[]>>>,
  setPagesById: Dispatch<SetStateAction<Record<string, WorkspacePage>>>,
  setPageDetailsById: Dispatch<
    SetStateAction<Record<string, WorkspacePageDetail>>
  >,
  setRootError: Dispatch<SetStateAction<string | null>>,
  loadedDepthByDirRef: RefObject<Map<string, number>>,
  inflightDepthByDirRef: RefObject<Map<string, number>>,
  childrenByDirStableRef: RefObject<Record<string, WorkspacePage[]>>,
) {
  setChildrenByDir({});
  setPagesById({});
  setPageDetailsById({});
  setRootError(null);
  loadedDepthByDirRef.current.clear();
  inflightDepthByDirRef.current.clear();
  childrenByDirStableRef.current = {};
}

export function maybeSetRootError(
  setRootError: Dispatch<SetStateAction<string | null>>,
  parentPath: string,
  childrenByDirStableRef: RefObject<Record<string, WorkspacePage[]>>,
  error: unknown,
) {
  if (isIgnorableRpcError(error)) return;
  if (parentPath !== ROOT_PAGES_DIR) return;
  if (childrenByDirStableRef.current[parentPath]?.length) return;
  setRootError(
    error instanceof Error ? error.message : "Failed to load pages",
  );
}
