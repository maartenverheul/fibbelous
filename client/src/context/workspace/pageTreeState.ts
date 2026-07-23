import type { Dispatch, RefObject, SetStateAction } from "react";
import { isIgnorableRpcError } from "../../lib/rpc";
import {
  treeCacheKey,
  type WorkspacePage,
  type WorkspacePageDetail,
} from "../../types/page";

export function resetPageTree(
  setChildrenByParent: Dispatch<
    SetStateAction<Record<string, WorkspacePage[]>>
  >,
  setPagesById: Dispatch<SetStateAction<Record<string, WorkspacePage>>>,
  setPageDetailsById: Dispatch<
    SetStateAction<Record<string, WorkspacePageDetail>>
  >,
  setRootError: Dispatch<SetStateAction<string | null>>,
  loadedDepthByParentRef: RefObject<Map<string, number>>,
  inflightDepthByParentRef: RefObject<Map<string, number>>,
  childrenByParentStableRef: RefObject<Record<string, WorkspacePage[]>>,
) {
  setChildrenByParent({});
  setPagesById({});
  setPageDetailsById({});
  setRootError(null);
  loadedDepthByParentRef.current.clear();
  inflightDepthByParentRef.current.clear();
  childrenByParentStableRef.current = {};
}

export function maybeSetRootError(
  setRootError: Dispatch<SetStateAction<string | null>>,
  parentId: string | null,
  childrenByParentStableRef: RefObject<Record<string, WorkspacePage[]>>,
  error: unknown,
) {
  if (isIgnorableRpcError(error)) return;
  if (parentId !== null) return;
  if (childrenByParentStableRef.current[treeCacheKey(parentId)]?.length) return;
  setRootError(
    error instanceof Error ? error.message : "Failed to load pages",
  );
}
