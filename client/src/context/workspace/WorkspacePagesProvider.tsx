import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  DatabaseRowsPage,
  WorkspaceDatabaseDetail,
} from "../../types/database";
import {
  DEFAULT_LIST_PAGES_DEPTH,
  isPagePathSegment,
  parentKeyOfPage,
  parsePageIdFromSegment,
  treeCacheKey,
  type BodyPatch,
  type SearchPageHit,
  type TrashedPage,
  type TrashedPageDetail,
  type WorkspacePage,
  type WorkspacePageDetail,
} from "../../types/page";
import { slugFromPageLink } from "../../lib/pageLinks";
import {
  registerDatabaseFetcher,
  registerDatabaseRowCreator,
  registerDatabaseRowsFetcher,
  registerDatabaseViewUpdater,
} from "../../lib/databaseFetch";
import { useWorkspaceConnection } from "./WorkspaceConnectionProvider";
import { maybeSetRootError, resetPageTree } from "./pageTreeState";
import { useWorkspaceSession } from "./WorkspaceSessionProvider";

export type WorkspacePagesValue = {
  rootPages: WorkspacePage[] | undefined;
  favoritePages: WorkspacePage[];
  rootError: string | null;
  getChildren: (parentId: string | null) => WorkspacePage[] | undefined;
  ensureChildren: (parentId: string | null, depth?: number) => void;
  ensurePageTreeVisible: (segment: string) => void;
  findPageByKey: (key: string) => WorkspacePage | undefined;
  findPageById: (id: string) => WorkspacePage | undefined;
  getPageDetailById: (id: string) => WorkspacePageDetail | undefined;
  fetchPageById: (id: string) => Promise<WorkspacePage | null>;
  fetchPageDetail: (id: string) => Promise<WorkspacePageDetail | null>;
  fetchTrashedPageDetail: (id: string) => Promise<TrashedPageDetail | null>;
  createPage: (
    parentPage: WorkspacePage,
    init?: { title?: string; body?: string },
  ) => Promise<WorkspacePageDetail>;
  createRootPage: (init?: {
    title?: string;
    body?: string;
  }) => Promise<WorkspacePageDetail>;
  updatePage: (
    id: string,
    patch: {
      title?: string;
      body?: string;
      bodyPatch?: BodyPatch;
      slug?: string;
      icon?: string | null;
      favorite?: boolean;
      attributes?: Record<string, unknown>;
    },
  ) => Promise<WorkspacePageDetail>;
  setPageFavorite: (id: string, favorite: boolean) => Promise<WorkspacePageDetail>;
  duplicatePage: (id: string) => Promise<WorkspacePageDetail>;
  trashPage: (page: WorkspacePage) => Promise<string[]>;
  searchPages: (query: string) => Promise<SearchPageHit[]>;
  listTrashedPages: () => Promise<TrashedPage[]>;
  restorePage: (id: string) => Promise<WorkspacePageDetail>;
  purgePage: (id: string) => Promise<void>;
  reloadPages: () => Promise<void>;
};

const WorkspacePagesContext = createContext<WorkspacePagesValue | null>(null);

export function WorkspacePagesProvider({ children }: { children: ReactNode }) {
  const { activeWorkspace } = useWorkspaceSession();
  const { rpc, connectionStatus, connectionGenerationRef } =
    useWorkspaceConnection();

  const [childrenByParent, setChildrenByParent] = useState<
    Record<string, WorkspacePage[]>
  >({});
  const [pagesById, setPagesById] = useState<Record<string, WorkspacePage>>(
    {},
  );
  const [pageDetailsById, setPageDetailsById] = useState<
    Record<string, WorkspacePageDetail>
  >({});
  const [favoritePages, setFavoritePages] = useState<WorkspacePage[]>([]);
  const [rootError, setRootError] = useState<string | null>(null);
  /** Max `list_pages` depth successfully stored per parent. */
  const loadedDepthByParentRef = useRef(new Map<string, number>());
  /** In-flight request depth per parent (skip duplicate / shallower fetches). */
  const inflightDepthByParentRef = useRef(new Map<string, number>());
  const childrenByParentStableRef = useRef<Record<string, WorkspacePage[]>>({});
  const lastTreeWorkspaceIdRef = useRef<string | null>(null);

  useEffect(() => {
    const workspaceId = activeWorkspace?.workspaceId ?? null;
    if (lastTreeWorkspaceIdRef.current === workspaceId) {
      if (workspaceId) setRootError(null);
      return;
    }

    resetPageTree(
      setChildrenByParent,
      setPagesById,
      setPageDetailsById,
      setRootError,
      loadedDepthByParentRef,
      inflightDepthByParentRef,
      childrenByParentStableRef,
    );
    setFavoritePages([]);
    lastTreeWorkspaceIdRef.current = workspaceId;
  }, [activeWorkspace?.workspaceId]);

  const refreshFavoritePages = useCallback(async () => {
    if (!rpc || connectionStatus !== "connected") {
      setFavoritePages([]);
      return;
    }
    try {
      const pages = await rpc.call<WorkspacePage[]>("list_favorite_pages");
      setFavoritePages(pages);
      setPagesById((prev) => {
        const next = { ...prev };
        for (const page of pages) {
          next[page.id] = { ...next[page.id], ...page, favorite: true };
        }
        return next;
      });
    } catch (error) {
      console.error(error);
    }
  }, [rpc, connectionStatus]);

  useEffect(() => {
    if (!rpc || connectionStatus !== "connected") {
      setFavoritePages([]);
      return;
    }
    void refreshFavoritePages();
  }, [rpc, connectionStatus, refreshFavoritePages]);

  const storePages = useCallback(
    (parentId: string | null, pages: WorkspacePage[], depth: number) => {
      const childrenByParent = {} as Record<string, WorkspacePage[]>;
      const byId: Record<string, WorkspacePage> = {};
      const depths = new Map<string, number>();

      const visit = (
        currentParentId: string | null,
        list: WorkspacePage[],
        remainingDepth: number,
      ) => {
        const flat: WorkspacePage[] = [];
        for (const page of list) {
          const { children: nested, ...rest } = page;
          flat.push(rest);
          byId[rest.id] = rest;
          if (nested !== undefined) {
            visit(rest.id, nested, remainingDepth - 1);
          }
        }
        const key = treeCacheKey(currentParentId);
        childrenByParent[key] = flat;
        depths.set(
          key,
          Math.max(depths.get(key) ?? 0, remainingDepth),
        );
      };
      visit(parentId, pages, depth);

      setChildrenByParent((prev) => {
        const next = { ...prev, ...childrenByParent };
        for (const [key, list] of Object.entries(childrenByParent)) {
          childrenByParentStableRef.current[key] = list;
        }
        return next;
      });
      setPagesById((prev) => ({ ...prev, ...byId }));

      for (const [key, loadedDepth] of depths) {
        const prev = loadedDepthByParentRef.current.get(key) ?? 0;
        if (loadedDepth > prev) {
          loadedDepthByParentRef.current.set(key, loadedDepth);
        }
      }
    },
    [],
  );

  const listChildren = useCallback(
    async (parentId: string | null, depth = DEFAULT_LIST_PAGES_DEPTH) => {
      if (!rpc || connectionStatus !== "connected") return null;

      const generation = connectionGenerationRef.current;
      const result = await rpc.call<WorkspacePage[]>("list_pages", {
        parentId,
        depth,
      });
      if (generation !== connectionGenerationRef.current) return null;

      storePages(parentId, result, depth);
      if (parentId === null) {
        setRootError(null);
      }
      return result;
    },
    [rpc, connectionStatus, connectionGenerationRef, storePages],
  );

  const refreshChildren = useCallback(
    async (parentId: string | null, depth = DEFAULT_LIST_PAGES_DEPTH) => {
      if (!rpc || connectionStatus !== "connected") return [];
      const key = treeCacheKey(parentId);

      loadedDepthByParentRef.current.delete(key);

      const inflight = inflightDepthByParentRef.current.get(key) ?? 0;
      if (inflight >= depth) {
        return childrenByParentStableRef.current[key] ?? [];
      }

      inflightDepthByParentRef.current.set(key, depth);
      try {
        return (await listChildren(parentId, depth)) ?? [];
      } catch (err) {
        maybeSetRootError(
          setRootError,
          parentId,
          childrenByParentStableRef,
          err,
        );
        return childrenByParentStableRef.current[key] ?? [];
      } finally {
        if (inflightDepthByParentRef.current.get(key) === depth) {
          inflightDepthByParentRef.current.delete(key);
        }
      }
    },
    [rpc, connectionStatus, listChildren],
  );

  const invalidateAndRefreshChildren = useCallback(
    async (...parentIds: Array<string | null>) => {
      const unique = [...new Set(parentIds)];
      for (const parentId of unique) {
        const key = treeCacheKey(parentId);
        loadedDepthByParentRef.current.delete(key);
        inflightDepthByParentRef.current.delete(key);
      }
      for (const parentId of unique) {
        await refreshChildren(parentId);
      }
    },
    [refreshChildren],
  );

  const storePageDetail = useCallback((detail: WorkspacePageDetail) => {
    const {
      ancestors = [],
      body: _body,
      referencedPages,
      ...page
    } = detail;
    setPagesById((prev) => {
      const next = { ...prev, [page.id]: page };
      for (const ancestor of ancestors) {
        next[ancestor.id] = { ...next[ancestor.id], ...ancestor };
      }
      for (const ref of referencedPages) {
        const existing = next[ref.id];
        if (existing) continue;
        next[ref.id] = {
          id: ref.id,
          slug: slugFromPageLink(ref.link),
          title: ref.name,
          icon: ref.icon,
          path: ref.link,
          hasChildren: false,
        };
      }
      return next;
    });
    setPageDetailsById((prev) => ({ ...prev, [detail.id]: detail }));
  }, []);

  useEffect(() => {
    if (!rpc || connectionStatus !== "connected") {
      registerDatabaseFetcher(null);
      registerDatabaseRowsFetcher(null);
      registerDatabaseRowCreator(null);
      registerDatabaseViewUpdater(null);
      return;
    }

    registerDatabaseFetcher(async (id) => {
      return rpc.call<WorkspaceDatabaseDetail | null>("get_database", { id });
    });
    registerDatabaseRowsFetcher(async (id, { limit, offset, sort }) => {
      return rpc.call<DatabaseRowsPage | null>("list_database_rows", {
        id,
        limit,
        offset,
        sort: sort ?? null,
      });
    });
    registerDatabaseRowCreator(async (id, title) => {
      const detail = await rpc.call<WorkspacePageDetail>("create_database_row", {
        id,
        title,
      });
      storePageDetail(detail);
      return detail;
    });
    registerDatabaseViewUpdater(async (databaseId, viewId, update) => {
      const detail = await rpc.call<WorkspaceDatabaseDetail | null>(
        "update_database_view",
        {
          id: databaseId,
          viewId,
          ...update,
        },
      );
      if (!detail) {
        throw new Error("Database not found");
      }
      return detail;
    });

    return () => {
      registerDatabaseFetcher(null);
      registerDatabaseRowsFetcher(null);
      registerDatabaseRowCreator(null);
      registerDatabaseViewUpdater(null);
    };
  }, [rpc, connectionStatus, storePageDetail]);

  const removePageIdFromCache = useCallback((id: string) => {
    setPagesById((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setPageDetailsById((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setChildrenByParent((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        const filtered = next[key].filter((item) => item.id !== id);
        if (filtered.length !== next[key].length) {
          next[key] = filtered;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const ensureChildren = useCallback(
    (parentId: string | null, depth = DEFAULT_LIST_PAGES_DEPTH) => {
      if (!rpc || connectionStatus !== "connected") return;
      const key = treeCacheKey(parentId);

      const loaded = loadedDepthByParentRef.current.get(key) ?? 0;
      if (loaded >= depth) return;

      const inflight = inflightDepthByParentRef.current.get(key) ?? 0;
      if (inflight >= depth) return;

      inflightDepthByParentRef.current.set(key, depth);

      listChildren(parentId, depth)
        .catch((err) => {
          maybeSetRootError(
            setRootError,
            parentId,
            childrenByParentStableRef,
            err,
          );
        })
        .finally(() => {
          if (inflightDepthByParentRef.current.get(key) === depth) {
            inflightDepthByParentRef.current.delete(key);
          }
        });
    },
    [rpc, connectionStatus, listChildren],
  );

  useEffect(() => {
    if (!rpc || connectionStatus !== "connected") return;
    ensureChildren(null);
  }, [rpc, connectionStatus, ensureChildren]);

  const getChildren = useCallback(
    (parentId: string | null) => {
      const key = treeCacheKey(parentId);
      const current = childrenByParent[key];
      if (current !== undefined) {
        childrenByParentStableRef.current[key] = current;
        return current;
      }
      return childrenByParentStableRef.current[key];
    },
    [childrenByParent],
  );

  const pageFromDetail = useCallback(
    (detail: WorkspacePageDetail): WorkspacePage => {
      const {
        body: _body,
        referencedPages: _referencedPages,
        ancestors: _ancestors,
        ...page
      } = detail;
      return page;
    },
    [],
  );

  const findPageById = useCallback(
    (id: string) => {
      const cached = pagesById[id];
      if (cached) return cached;

      const detail = pageDetailsById[id];
      if (detail) return pageFromDetail(detail);

      for (const pages of Object.values(childrenByParent)) {
        const match = pages.find((page) => page.id === id);
        if (match) return match;
      }

      return undefined;
    },
    [childrenByParent, pagesById, pageDetailsById, pageFromDetail],
  );
  const pagesByIdRef = useRef(pagesById);
  pagesByIdRef.current = pagesById;

  const getPageDetailById = useCallback(
    (id: string) => pageDetailsById[id],
    [pageDetailsById],
  );

  const findPageByKey = useCallback(
    (segment: string) => {
      const pageId = parsePageIdFromSegment(segment);
      if (!pageId) return undefined;
      return findPageById(pageId);
    },
    [findPageById],
  );

  const ensurePageTreeVisible = useCallback(
    (segment: string) => {
      if (!isPagePathSegment(segment)) return;
    },
    [],
  );

  const fetchPageById = useCallback(
    async (id: string) => {
      const cached = pagesByIdRef.current[id];
      if (cached) return cached;
      if (!rpc || connectionStatus !== "connected") return null;

      const detail = await rpc.call<WorkspacePageDetail | null>("get_page", {
        id,
      });
      if (!detail) return null;

      storePageDetail(detail);
      const { body: _body, ...page } = detail;
      return page;
    },
    [rpc, connectionStatus, storePageDetail],
  );

  const fetchPageDetail = useCallback(
    async (id: string) => {
      if (!rpc || connectionStatus !== "connected") return null;

      const detail = await rpc.call<WorkspacePageDetail | null>("get_page", {
        id,
      });
      if (!detail) return null;

      storePageDetail(detail);
      return detail;
    },
    [rpc, connectionStatus, storePageDetail],
  );

  const fetchTrashedPageDetail = useCallback(
    async (id: string) => {
      if (!rpc || connectionStatus !== "connected") return null;

      return rpc.call<TrashedPageDetail | null>("get_trashed_page", { id });
    },
    [rpc, connectionStatus],
  );

  const createPage = useCallback(
    async (
      parentPage: WorkspacePage,
      init?: { title?: string; body?: string },
    ) => {
      if (!rpc || connectionStatus !== "connected") {
        throw new Error("Workspace not connected");
      }

      const detail = await rpc.call<WorkspacePageDetail>("create_page", {
        parentId: parentPage.id,
        title: init?.title ?? "",
        body: init?.body ?? "",
      });

      storePageDetail(detail);
      await invalidateAndRefreshChildren(
        parentPage.id,
        parentKeyOfPage(parentPage),
      );
      return detail;
    },
    [rpc, connectionStatus, invalidateAndRefreshChildren, storePageDetail],
  );

  const createRootPage = useCallback(
    async (init?: { title?: string; body?: string }) => {
      if (!rpc || connectionStatus !== "connected") {
        throw new Error("Workspace not connected");
      }

      const detail = await rpc.call<WorkspacePageDetail>("create_page", {
        parentId: null,
        title: init?.title ?? "",
        body: init?.body ?? "",
      });

      storePageDetail(detail);
      await invalidateAndRefreshChildren(null);
      return detail;
    },
    [rpc, connectionStatus, invalidateAndRefreshChildren, storePageDetail],
  );

  const updatePage = useCallback(
    async (
      id: string,
      patch: {
        title?: string;
        body?: string;
        bodyPatch?: BodyPatch;
        slug?: string;
        icon?: string | null;
        favorite?: boolean;
        attributes?: Record<string, unknown>;
      },
    ) => {
      if (!rpc || connectionStatus !== "connected") {
        throw new Error("Workspace not connected");
      }

      const detail = await rpc.call<WorkspacePageDetail>("update_page", {
        id,
        ...patch,
      });

      storePageDetail(detail);

      // Body-only autosaves must not re-list the parent dir; only tree-facing
      // fields (title / slug / icon) need a fresh list_pages.
      const treeChanged =
        patch.title !== undefined ||
        patch.slug !== undefined ||
        patch.icon !== undefined;
      if (treeChanged) {
        await invalidateAndRefreshChildren(parentKeyOfPage(detail));
      }

      if (patch.favorite !== undefined) {
        await refreshFavoritePages();
      }

      return detail;
    },
    [
      rpc,
      connectionStatus,
      invalidateAndRefreshChildren,
      storePageDetail,
      refreshFavoritePages,
    ],
  );

  const setPageFavorite = useCallback(
    async (id: string, favorite: boolean) => {
      return updatePage(id, { favorite });
    },
    [updatePage],
  );

  const duplicatePage = useCallback(
    async (id: string) => {
      if (!rpc || connectionStatus !== "connected") {
        throw new Error("Workspace not connected");
      }

      const detail = await rpc.call<WorkspacePageDetail>("duplicate_page", {
        id,
      });
      storePageDetail(detail);
      await invalidateAndRefreshChildren(parentKeyOfPage(detail));
      return detail;
    },
    [rpc, connectionStatus, invalidateAndRefreshChildren, storePageDetail],
  );

  const trashPage = useCallback(
    async (page: WorkspacePage) => {
      if (!rpc || connectionStatus !== "connected") {
        throw new Error("Workspace not connected");
      }

      const result = await rpc.call<{ trashedIds: string[] }>("trash_page", {
        id: page.id,
      });
      for (const id of result.trashedIds) {
        removePageIdFromCache(id);
      }
      setFavoritePages((prev) =>
        prev.filter((page) => !result.trashedIds.includes(page.id)),
      );
      await invalidateAndRefreshChildren(parentKeyOfPage(page));
      return result.trashedIds;
    },
    [
      rpc,
      connectionStatus,
      removePageIdFromCache,
      invalidateAndRefreshChildren,
    ],
  );

  const listTrashedPages = useCallback(async () => {
    if (!rpc || connectionStatus !== "connected") {
      throw new Error("Workspace not connected");
    }
    return rpc.call<TrashedPage[]>("list_trashed_pages");
  }, [rpc, connectionStatus]);

  const searchPages = useCallback(
    async (query: string) => {
      if (!rpc || connectionStatus !== "connected") {
        throw new Error("Workspace not connected");
      }
      return rpc.call<SearchPageHit[]>("search_pages", { query });
    },
    [rpc, connectionStatus],
  );

  const restorePage = useCallback(
    async (id: string) => {
      if (!rpc || connectionStatus !== "connected") {
        throw new Error("Workspace not connected");
      }

      const detail = await rpc.call<WorkspacePageDetail>("restore_page", { id });
      storePageDetail(detail);
      await invalidateAndRefreshChildren(parentKeyOfPage(detail));
      return detail;
    },
    [rpc, connectionStatus, invalidateAndRefreshChildren, storePageDetail],
  );

  const purgePage = useCallback(
    async (id: string) => {
      if (!rpc || connectionStatus !== "connected") {
        throw new Error("Workspace not connected");
      }
      await rpc.call("purge_page", { id });
    },
    [rpc, connectionStatus],
  );

  const reloadPages = useCallback(async () => {
    resetPageTree(
      setChildrenByParent,
      setPagesById,
      setPageDetailsById,
      setRootError,
      loadedDepthByParentRef,
      inflightDepthByParentRef,
      childrenByParentStableRef,
    );
    setFavoritePages([]);
    if (!rpc || connectionStatus !== "connected") return;
    await refreshChildren(null);
    await refreshFavoritePages();
  }, [rpc, connectionStatus, refreshChildren, refreshFavoritePages]);

  const rootPages = getChildren(null);

  const value = useMemo(
    () => ({
      rootPages,
      favoritePages,
      rootError,
      getChildren,
      ensureChildren,
      ensurePageTreeVisible,
      findPageByKey,
      findPageById,
      getPageDetailById,
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
      reloadPages,
    }),
    [
      rootPages,
      favoritePages,
      rootError,
      getChildren,
      ensureChildren,
      ensurePageTreeVisible,
      findPageByKey,
      findPageById,
      getPageDetailById,
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
      reloadPages,
    ],
  );

  return (
    <WorkspacePagesContext.Provider value={value}>
      {children}
    </WorkspacePagesContext.Provider>
  );
}

export function useWorkspacePagesContext() {
  const context = useContext(WorkspacePagesContext);
  if (!context) {
    throw new Error(
      "useWorkspacePagesContext must be used within WorkspacePagesProvider",
    );
  }
  return context;
}

export function useWorkspacePagesContextOptional() {
  return useContext(WorkspacePagesContext);
}
