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
  ROOT_PAGES_DIR,
  buildPageBreadcrumbs,
  childrenDir,
  isPagePathSegment,
  parentDirOfPage,
  parsePageIdFromSegment,
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
  rootError: string | null;
  getChildren: (parentPath: string) => WorkspacePage[] | undefined;
  ensureChildren: (parentPath: string, depth?: number) => void;
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
    },
  ) => Promise<WorkspacePageDetail>;
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

  const [childrenByDir, setChildrenByDir] = useState<
    Record<string, WorkspacePage[]>
  >({});
  const [pagesById, setPagesById] = useState<Record<string, WorkspacePage>>(
    {},
  );
  const [pageDetailsById, setPageDetailsById] = useState<
    Record<string, WorkspacePageDetail>
  >({});
  const [rootError, setRootError] = useState<string | null>(null);
  /** Max `list_pages` depth successfully stored per dir. */
  const loadedDepthByDirRef = useRef(new Map<string, number>());
  /** In-flight request depth per dir (skip duplicate / shallower fetches). */
  const inflightDepthByDirRef = useRef(new Map<string, number>());
  const childrenByDirStableRef = useRef<Record<string, WorkspacePage[]>>({});
  const lastTreeWorkspaceIdRef = useRef<string | null>(null);

  useEffect(() => {
    const workspaceId = activeWorkspace?.workspaceId ?? null;
    if (lastTreeWorkspaceIdRef.current === workspaceId) {
      if (workspaceId) setRootError(null);
      return;
    }

    resetPageTree(
      setChildrenByDir,
      setPagesById,
      setPageDetailsById,
      setRootError,
      loadedDepthByDirRef,
      inflightDepthByDirRef,
      childrenByDirStableRef,
    );
    lastTreeWorkspaceIdRef.current = workspaceId;
  }, [activeWorkspace?.workspaceId]);

  const storePages = useCallback(
    (parentPath: string, pages: WorkspacePage[], depth: number) => {
      const dirs: Record<string, WorkspacePage[]> = {};
      const byId: Record<string, WorkspacePage> = {};
      const depths = new Map<string, number>();

      const visit = (
        dir: string,
        list: WorkspacePage[],
        remainingDepth: number,
      ) => {
        const flat: WorkspacePage[] = [];
        for (const page of list) {
          const { children: nested, ...rest } = page;
          flat.push(rest);
          byId[rest.id] = rest;
          if (nested !== undefined) {
            visit(childrenDir(rest), nested, remainingDepth - 1);
          }
        }
        dirs[dir] = flat;
        depths.set(
          dir,
          Math.max(depths.get(dir) ?? 0, remainingDepth),
        );
      };
      visit(parentPath, pages, depth);

      setChildrenByDir((prev) => {
        const next = { ...prev, ...dirs };
        for (const [dir, list] of Object.entries(dirs)) {
          childrenByDirStableRef.current[dir] = list;
        }
        return next;
      });
      setPagesById((prev) => ({ ...prev, ...byId }));

      for (const [dir, loadedDepth] of depths) {
        const prev = loadedDepthByDirRef.current.get(dir) ?? 0;
        if (loadedDepth > prev) {
          loadedDepthByDirRef.current.set(dir, loadedDepth);
        }
      }
    },
    [],
  );

  const listDir = useCallback(
    async (parentPath: string, depth = DEFAULT_LIST_PAGES_DEPTH) => {
      if (!rpc || connectionStatus !== "connected") return null;

      const generation = connectionGenerationRef.current;
      const result = await rpc.call<WorkspacePage[]>("list_pages", {
        parentPath,
        depth,
      });
      if (generation !== connectionGenerationRef.current) return null;

      storePages(parentPath, result, depth);
      if (parentPath === ROOT_PAGES_DIR) {
        setRootError(null);
      }
      return result;
    },
    [rpc, connectionStatus, connectionGenerationRef, storePages],
  );

  const refreshDir = useCallback(
    async (parentPath: string, depth = DEFAULT_LIST_PAGES_DEPTH) => {
      if (!rpc || connectionStatus !== "connected") return [];

      loadedDepthByDirRef.current.delete(parentPath);

      const inflight = inflightDepthByDirRef.current.get(parentPath) ?? 0;
      if (inflight >= depth) {
        return childrenByDirStableRef.current[parentPath] ?? [];
      }

      inflightDepthByDirRef.current.set(parentPath, depth);
      try {
        return (await listDir(parentPath, depth)) ?? [];
      } catch (err) {
        maybeSetRootError(
          setRootError,
          parentPath,
          childrenByDirStableRef,
          err,
        );
        return childrenByDirStableRef.current[parentPath] ?? [];
      } finally {
        if (inflightDepthByDirRef.current.get(parentPath) === depth) {
          inflightDepthByDirRef.current.delete(parentPath);
        }
      }
    },
    [rpc, connectionStatus, listDir],
  );

  const invalidateAndRefreshDirs = useCallback(
    async (...parentPaths: string[]) => {
      const unique = [...new Set(parentPaths)];
      for (const parentPath of unique) {
        loadedDepthByDirRef.current.delete(parentPath);
        inflightDepthByDirRef.current.delete(parentPath);
      }
      for (const parentPath of unique) {
        await refreshDir(parentPath);
      }
    },
    [refreshDir],
  );

  const storePageDetail = useCallback((detail: WorkspacePageDetail) => {
    const { body: _body, referencedPages, ...page } = detail;
    setPagesById((prev) => {
      const next = { ...prev, [page.id]: page };
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
    setChildrenByDir((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const dir of Object.keys(next)) {
        const filtered = next[dir].filter((item) => item.id !== id);
        if (filtered.length !== next[dir].length) {
          next[dir] = filtered;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const ensureChildren = useCallback(
    (parentPath: string, depth = DEFAULT_LIST_PAGES_DEPTH) => {
      if (!rpc || connectionStatus !== "connected") return;

      const loaded = loadedDepthByDirRef.current.get(parentPath) ?? 0;
      if (loaded >= depth) return;

      const inflight = inflightDepthByDirRef.current.get(parentPath) ?? 0;
      if (inflight >= depth) return;

      inflightDepthByDirRef.current.set(parentPath, depth);

      listDir(parentPath, depth)
        .catch((err) => {
          maybeSetRootError(
            setRootError,
            parentPath,
            childrenByDirStableRef,
            err,
          );
        })
        .finally(() => {
          if (inflightDepthByDirRef.current.get(parentPath) === depth) {
            inflightDepthByDirRef.current.delete(parentPath);
          }
        });
    },
    [rpc, connectionStatus, listDir],
  );

  useEffect(() => {
    if (!rpc || connectionStatus !== "connected") return;
    ensureChildren(ROOT_PAGES_DIR);
  }, [rpc, connectionStatus, ensureChildren]);

  const getChildren = useCallback(
    (parentPath: string) => {
      const current = childrenByDir[parentPath];
      if (current !== undefined) {
        childrenByDirStableRef.current[parentPath] = current;
        return current;
      }
      return childrenByDirStableRef.current[parentPath];
    },
    [childrenByDir],
  );

  const pageFromDetail = useCallback(
    (detail: WorkspacePageDetail): WorkspacePage => {
      const { body: _body, referencedPages: _referencedPages, ...page } =
        detail;
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

      for (const pages of Object.values(childrenByDir)) {
        const match = pages.find((page) => page.id === id);
        if (match) return match;
      }

      return undefined;
    },
    [childrenByDir, pagesById, pageDetailsById, pageFromDetail],
  );
  const findPageByIdRef = useRef(findPageById);
  findPageByIdRef.current = findPageById;

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

  const ensurePageAncestorsVisible = useCallback(
    async (page: WorkspacePage) => {
      const lookup = (id: string) => findPageByIdRef.current(id);

      if (page.databaseId) {
        let host = lookup(page.databaseId);
        if (!host && rpc && connectionStatus === "connected") {
          const hostDetail = await rpc.call<WorkspacePageDetail | null>(
            "get_page",
            { id: page.databaseId },
          );
          if (hostDetail) {
            storePageDetail(hostDetail);
            host = pageFromDetail(hostDetail);
          }
        }
        if (host) {
          ensureChildren(parentDirOfPage(host));
          const crumbs = buildPageBreadcrumbs(host, lookup);
          for (const crumb of crumbs) {
            if (crumb.hasChildren) {
              ensureChildren(childrenDir(crumb));
            }
          }
        }
        return;
      }

      ensureChildren(parentDirOfPage(page));
      const crumbs = buildPageBreadcrumbs(page, lookup);
      for (const crumb of crumbs) {
        if (crumb.hasChildren) {
          ensureChildren(childrenDir(crumb));
        }
      }
    },
    [rpc, connectionStatus, storePageDetail, pageFromDetail, ensureChildren],
  );

  const ensurePageTreeVisible = useCallback(
    (segment: string) => {
      if (!isPagePathSegment(segment)) return;

      const pageId = parsePageIdFromSegment(segment);
      if (!pageId) return;

      const page = findPageByIdRef.current(pageId);
      if (!page) return;

      void ensurePageAncestorsVisible(page);
    },
    [ensurePageAncestorsVisible],
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
      await ensurePageAncestorsVisible(page);
      return page;
    },
    [rpc, connectionStatus, storePageDetail, ensurePageAncestorsVisible],
  );

  const fetchPageDetail = useCallback(
    async (id: string) => {
      if (!rpc || connectionStatus !== "connected") return null;

      const detail = await rpc.call<WorkspacePageDetail | null>("get_page", {
        id,
      });
      if (!detail) return null;

      storePageDetail(detail);
      await ensurePageAncestorsVisible(pageFromDetail(detail));
      return detail;
    },
    [
      rpc,
      connectionStatus,
      storePageDetail,
      ensurePageAncestorsVisible,
      pageFromDetail,
    ],
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

      const parentPath = childrenDir(parentPage);
      const detail = await rpc.call<WorkspacePageDetail>("create_page", {
        parentPath,
        title: init?.title ?? "Untitled",
        body: init?.body ?? "",
      });

      storePageDetail(detail);
      await invalidateAndRefreshDirs(parentPath, parentDirOfPage(parentPage));
      return detail;
    },
    [rpc, connectionStatus, invalidateAndRefreshDirs, storePageDetail],
  );

  const createRootPage = useCallback(
    async (init?: { title?: string; body?: string }) => {
      if (!rpc || connectionStatus !== "connected") {
        throw new Error("Workspace not connected");
      }

      const detail = await rpc.call<WorkspacePageDetail>("create_page", {
        parentPath: ROOT_PAGES_DIR,
        title: init?.title ?? "Untitled",
        body: init?.body ?? "",
      });

      storePageDetail(detail);
      await invalidateAndRefreshDirs(ROOT_PAGES_DIR);
      return detail;
    },
    [rpc, connectionStatus, invalidateAndRefreshDirs, storePageDetail],
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
        await invalidateAndRefreshDirs(parentDirOfPage(detail));
      }

      return detail;
    },
    [rpc, connectionStatus, invalidateAndRefreshDirs, storePageDetail],
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
      await invalidateAndRefreshDirs(parentDirOfPage(detail));
      return detail;
    },
    [rpc, connectionStatus, invalidateAndRefreshDirs, storePageDetail],
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
      await invalidateAndRefreshDirs(parentDirOfPage(page));
      return result.trashedIds;
    },
    [rpc, connectionStatus, removePageIdFromCache, invalidateAndRefreshDirs],
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
      await invalidateAndRefreshDirs(parentDirOfPage(detail));
      return detail;
    },
    [rpc, connectionStatus, invalidateAndRefreshDirs, storePageDetail],
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
      setChildrenByDir,
      setPagesById,
      setPageDetailsById,
      setRootError,
      loadedDepthByDirRef,
      inflightDepthByDirRef,
      childrenByDirStableRef,
    );
    if (!rpc || connectionStatus !== "connected") return;
    await refreshDir(ROOT_PAGES_DIR);
  }, [rpc, connectionStatus, refreshDir]);

  const rootPages = getChildren(ROOT_PAGES_DIR);

  const value = useMemo(
    () => ({
      rootPages,
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
