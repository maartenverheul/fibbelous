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
import { useNavigate, useParams } from "react-router-dom";
import { useSavedWorkspaces } from "../hooks/useSavedWorkspaces";
import {
  fetchWorkspaces,
  isWorkspaceNotFoundError,
  workspaceWsUrl,
  ApiError,
} from "../lib/api";
import { createRpcClient, createLocalRpcClient, isIgnorableRpcError, type RpcClient } from "../lib/rpc";
import {
  buildWorkspaceConnectionKey,
  closePooledConnection,
  getPooledConnection,
  openPooledConnection,
} from "../lib/workspaceConnection";
import {
  workspaceManagerRedirectState,
  type WorkspaceNotice,
} from "../lib/navigation";
import {
  isLocalWorkspace,
  type SavedWorkspace,
  type WorkspaceConnectionStatus,
} from "../types/workspace";
import { openLocalWorkspace } from "../lib/tauri";
import {
  ROOT_PAGES_DIR,
  buildPageBreadcrumbs,
  childrenDir,
  isPagePathSegment,
  parentDirOfPage,
  parsePageIdFromSegment,
  type WorkspacePage,
  type WorkspacePageDetail,
  type SearchPageHit,
  type TrashedPage,
  type TrashedPageDetail,
} from "../types/page";
import type {
  DatabaseRowsPage,
  WorkspaceDatabaseDetail,
} from "../types/database";
import {
  registerDatabaseFetcher,
  registerDatabaseRowsFetcher,
  registerDatabaseRowCreator,
  registerDatabaseViewUpdater,
} from "../lib/databaseFetch";

type WorkspaceContextValue = {
  workspaces: SavedWorkspace[];
  activeWorkspace: SavedWorkspace | null;
  connectionStatus: WorkspaceConnectionStatus;
  rpc: RpcClient | null;
  rootPages: WorkspacePage[] | undefined;
  rootError: string | null;
  getChildren: (parentPath: string) => WorkspacePage[] | undefined;
  ensureChildren: (parentPath: string) => void;
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
  createRootPage: (
    init?: { title?: string; body?: string },
  ) => Promise<WorkspacePageDetail>;
  updatePage: (
    id: string,
    patch: { title?: string; body?: string; slug?: string; icon?: string | null },
  ) => Promise<WorkspacePageDetail>;
  duplicatePage: (id: string) => Promise<WorkspacePageDetail>;
  trashPage: (page: WorkspacePage) => Promise<string[]>;
  searchPages: (query: string) => Promise<SearchPageHit[]>;
  listTrashedPages: () => Promise<TrashedPage[]>;
  restorePage: (id: string) => Promise<WorkspacePageDetail>;
  purgePage: (id: string) => Promise<void>;
  reloadPages: () => Promise<void>;
  setActiveWorkspace: (workspace: SavedWorkspace) => void;
  addWorkspace: ReturnType<typeof useSavedWorkspaces>["addWorkspace"];
  updateWorkspace: ReturnType<typeof useSavedWorkspaces>["updateWorkspace"];
  removeWorkspace: ReturnType<typeof useSavedWorkspaces>["removeWorkspace"];
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function resetPageTree(
  setChildrenByDir: React.Dispatch<
    React.SetStateAction<Record<string, WorkspacePage[]>>
  >,
  setPagesById: React.Dispatch<
    React.SetStateAction<Record<string, WorkspacePage>>
  >,
  setPageDetailsById: React.Dispatch<
    React.SetStateAction<Record<string, WorkspacePageDetail>>
  >,
  setRootError: React.Dispatch<React.SetStateAction<string | null>>,
  loadedDirsRef: React.MutableRefObject<Set<string>>,
  inflightDirsRef: React.MutableRefObject<Set<string>>,
  childrenByDirStableRef: React.MutableRefObject<
    Record<string, WorkspacePage[]>
  >,
) {
  setChildrenByDir({});
  setPagesById({});
  setPageDetailsById({});
  setRootError(null);
  loadedDirsRef.current.clear();
  inflightDirsRef.current.clear();
  childrenByDirStableRef.current = {};
}

function maybeSetRootError(
  setRootError: React.Dispatch<React.SetStateAction<string | null>>,
  parentPath: string,
  childrenByDirStableRef: React.MutableRefObject<
    Record<string, WorkspacePage[]>
  >,
  error: unknown,
) {
  if (isIgnorableRpcError(error)) return;
  if (parentPath !== ROOT_PAGES_DIR) return;
  if (childrenByDirStableRef.current[parentPath]?.length) return;
  setRootError(
    error instanceof Error ? error.message : "Failed to load pages",
  );
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const {
    workspaces,
    activeWorkspace,
    addWorkspace,
    updateWorkspace,
    removeWorkspace,
    setActive,
    findBySlug,
  } = useSavedWorkspaces();

  const [connectionStatus, setConnectionStatus] =
    useState<WorkspaceConnectionStatus>("idle");
  const [rpc, setRpc] = useState<RpcClient | null>(null);
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
  const loadedDirsRef = useRef(new Set<string>());
  const inflightDirsRef = useRef(new Set<string>());
  const childrenByDirStableRef = useRef<Record<string, WorkspacePage[]>>({});
  const connectAttemptRef = useRef(0);
  const lastTreeWorkspaceIdRef = useRef<string | null>(null);
  const resolvedSlugRef = useRef<string | null>(null);
  const suppressActiveSyncRef = useRef(false);

  const workspaceFromUrl = slug ? (findBySlug(slug) ?? null) : null;

  useEffect(() => {
    if (!slug) {
      suppressActiveSyncRef.current = false;
      return;
    }

    if (workspaceFromUrl) {
      resolvedSlugRef.current = slug;
      if (
        !suppressActiveSyncRef.current &&
        activeWorkspace?.id !== workspaceFromUrl.id
      ) {
        setActive(workspaceFromUrl.id);
      }
      return;
    }

    if (activeWorkspace) {
      navigate(`/${activeWorkspace.slug}`, { replace: true });
      return;
    }

    if (resolvedSlugRef.current !== slug) {
      navigate("/", { replace: true });
    }
  }, [slug, workspaceFromUrl, activeWorkspace, navigate, setActive]);

  useEffect(() => {
    const workspace = workspaceFromUrl;
    if (!workspace) {
      closePooledConnection();
      setConnectionStatus("idle");
      setRpc(null);
      lastTreeWorkspaceIdRef.current = null;
      resetPageTree(
        setChildrenByDir,
        setPagesById,
        setPageDetailsById,
        setRootError,
        loadedDirsRef,
        inflightDirsRef,
        childrenByDirStableRef,
      );
      return;
    }

    let cancelled = false;
    const connectAttempt = ++connectAttemptRef.current;
    const connectionKey = buildWorkspaceConnectionKey(workspace);

    const redirectToWorkspaceManager = (notice: WorkspaceNotice) => {
      if (connectAttempt !== connectAttemptRef.current) return;
      suppressActiveSyncRef.current = true;
      navigate("/", {
        replace: true,
        state: workspaceManagerRedirectState(notice),
      });
    };

    if (lastTreeWorkspaceIdRef.current !== workspace.workspaceId) {
      resetPageTree(
        setChildrenByDir,
        setPagesById,
        setPageDetailsById,
        setRootError,
        loadedDirsRef,
        inflightDirsRef,
        childrenByDirStableRef,
      );
      lastTreeWorkspaceIdRef.current = workspace.workspaceId;
    } else {
      setRootError(null);
    }

    const existingClient = getPooledConnection(connectionKey);
    if (existingClient) {
      setRpc(existingClient);
      setConnectionStatus("connected");
      suppressActiveSyncRef.current = false;
      return () => {
        cancelled = true;
      };
    }

    setConnectionStatus("connecting");

    void (async () => {
      try {
        const client = await openPooledConnection(connectionKey, async () => {
          if (isLocalWorkspace(workspace) && workspace.localPath) {
            const info = await openLocalWorkspace(workspace.localPath);
            if (info.id !== workspace.workspaceId) {
              throw new ApiError(404, "Workspace not found");
            }
            const rpcClient = createLocalRpcClient(workspace.workspaceId);
            try {
              await rpcClient.call("ping");
              return rpcClient;
            } catch (error) {
              rpcClient.close();
              throw error;
            }
          }

          const remoteWorkspaces = await fetchWorkspaces(
            workspace.serverHost,
            workspace.serverPort,
          );
          if (
            !remoteWorkspaces.some((item) => item.id === workspace.workspaceId)
          ) {
            throw new ApiError(404, "Workspace not found");
          }

          const rpcClient = createRpcClient(
            workspaceWsUrl(
              workspace.serverHost,
              workspace.serverPort,
              workspace.workspaceId,
            ),
          );
          try {
            await rpcClient.call("ping");
            return rpcClient;
          } catch (error) {
            rpcClient.close();
            throw error;
          }
        });
        if (cancelled) return;
        if (connectAttempt !== connectAttemptRef.current) return;

        setRpc(client);
        setConnectionStatus("connected");
        suppressActiveSyncRef.current = false;
      } catch (error) {
        if (cancelled) return;
        if (connectAttempt !== connectAttemptRef.current) return;
        if (isWorkspaceNotFoundError(error)) {
          suppressActiveSyncRef.current = true;
          removeWorkspace(workspace.id);
          redirectToWorkspaceManager({
            kind: "missing",
            label: workspace.label,
          });
          return;
        }
        suppressActiveSyncRef.current = true;
        setActive(null);
        redirectToWorkspaceManager({
          kind: "connectionFailed",
          label: workspace.label,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    workspaceFromUrl?.id,
    workspaceFromUrl?.serverHost,
    workspaceFromUrl?.serverPort,
    workspaceFromUrl?.workspaceId,
    workspaceFromUrl?.localPath,
    removeWorkspace,
    navigate,
    setActive,
  ]);

  const storePages = useCallback((parentPath: string, pages: WorkspacePage[]) => {
    setChildrenByDir((prev) => ({ ...prev, [parentPath]: pages }));
    childrenByDirStableRef.current[parentPath] = pages;
    setPagesById((prev) => {
      const next = { ...prev };
      for (const page of pages) {
        next[page.id] = page;
      }
      return next;
    });
  }, []);

  const listDir = useCallback(
    async (parentPath: string) => {
      if (!rpc || connectionStatus !== "connected") return null;

      const generation = connectAttemptRef.current;
      const result = await rpc.call<WorkspacePage[]>("list_pages", { parentPath });
      if (generation !== connectAttemptRef.current) return null;

      loadedDirsRef.current.add(parentPath);
      storePages(parentPath, result);
      if (parentPath === ROOT_PAGES_DIR) {
        setRootError(null);
      }
      return result;
    },
    [rpc, connectionStatus, storePages],
  );

  const refreshDir = useCallback(
    async (parentPath: string) => {
      if (!rpc || connectionStatus !== "connected") return [];

      loadedDirsRef.current.delete(parentPath);

      if (inflightDirsRef.current.has(parentPath)) {
        return childrenByDirStableRef.current[parentPath] ?? [];
      }

      inflightDirsRef.current.add(parentPath);
      try {
        return (await listDir(parentPath)) ?? [];
      } catch (err) {
        maybeSetRootError(
          setRootError,
          parentPath,
          childrenByDirStableRef,
          err,
        );
        return childrenByDirStableRef.current[parentPath] ?? [];
      } finally {
        inflightDirsRef.current.delete(parentPath);
      }
    },
    [rpc, connectionStatus, listDir],
  );

  const invalidateAndRefreshDirs = useCallback(
    async (...parentPaths: string[]) => {
      const unique = [...new Set(parentPaths)];
      for (const parentPath of unique) {
        loadedDirsRef.current.delete(parentPath);
        inflightDirsRef.current.delete(parentPath);
      }
      for (const parentPath of unique) {
        await refreshDir(parentPath);
      }
    },
    [refreshDir],
  );

  const storePageDetail = useCallback((detail: WorkspacePageDetail) => {
    const { body: _body, ...page } = detail;
    setPagesById((prev) => ({ ...prev, [page.id]: page }));
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
    (parentPath: string) => {
      if (!rpc || connectionStatus !== "connected") return;
      if (
        loadedDirsRef.current.has(parentPath) ||
        inflightDirsRef.current.has(parentPath)
      ) {
        return;
      }

      inflightDirsRef.current.add(parentPath);

      listDir(parentPath)
        .catch((err) => {
          maybeSetRootError(
            setRootError,
            parentPath,
            childrenByDirStableRef,
            err,
          );
        })
        .finally(() => {
          inflightDirsRef.current.delete(parentPath);
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
      const { body: _body, ...page } = detail;
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
      if (page.databaseId) {
        let host = findPageById(page.databaseId);
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
          const crumbs = buildPageBreadcrumbs(host, findPageById);
          for (const crumb of crumbs) {
            if (crumb.hasChildren) {
              ensureChildren(childrenDir(crumb));
            }
          }
        }
        return;
      }

      ensureChildren(parentDirOfPage(page));
      const crumbs = buildPageBreadcrumbs(page, findPageById);
      for (const crumb of crumbs) {
        if (crumb.hasChildren) {
          ensureChildren(childrenDir(crumb));
        }
      }
    },
    [
      findPageById,
      rpc,
      connectionStatus,
      storePageDetail,
      pageFromDetail,
      ensureChildren,
    ],
  );

  const ensurePageTreeVisible = useCallback(
    (segment: string) => {
      if (!isPagePathSegment(segment)) return;

      const pageId = parsePageIdFromSegment(segment);
      if (!pageId) return;

      const page = findPageById(pageId);
      if (!page) return;

      void ensurePageAncestorsVisible(page);
    },
    [findPageById, ensurePageAncestorsVisible],
  );

  const fetchPageById = useCallback(
    async (id: string) => {
      const cached = pagesById[id];
      if (cached) return cached;
      if (!rpc || connectionStatus !== "connected") return null;

      const detail = await rpc.call<WorkspacePageDetail | null>("get_page", { id });
      if (!detail) return null;

      storePageDetail(detail);
      const { body: _body, ...page } = detail;
      await ensurePageAncestorsVisible(page);
      return page;
    },
    [
      pagesById,
      rpc,
      connectionStatus,
      storePageDetail,
      ensurePageAncestorsVisible,
    ],
  );

  const fetchPageDetail = useCallback(
    async (id: string) => {
      const cached = pageDetailsById[id];
      if (cached) return cached;

      if (!rpc || connectionStatus !== "connected") return null;

      const detail = await rpc.call<WorkspacePageDetail | null>("get_page", { id });
      if (!detail) return null;

      storePageDetail(detail);
      await ensurePageAncestorsVisible(pageFromDetail(detail));
      return detail;
    },
    [
      pageDetailsById,
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
    async (parentPage: WorkspacePage, init?: { title?: string; body?: string }) => {
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
      patch: { title?: string; body?: string; slug?: string; icon?: string | null },
    ) => {
      if (!rpc || connectionStatus !== "connected") {
        throw new Error("Workspace not connected");
      }

      const detail = await rpc.call<WorkspacePageDetail>("update_page", {
        id,
        ...patch,
      });

      storePageDetail(detail);
      await invalidateAndRefreshDirs(parentDirOfPage(detail));
      return detail;
    },
    [rpc, connectionStatus, invalidateAndRefreshDirs, storePageDetail],
  );

  const duplicatePage = useCallback(
    async (id: string) => {
      if (!rpc || connectionStatus !== "connected") {
        throw new Error("Workspace not connected");
      }

      const detail = await rpc.call<WorkspacePageDetail>("duplicate_page", { id });
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
      loadedDirsRef,
      inflightDirsRef,
      childrenByDirStableRef,
    );
    if (!rpc || connectionStatus !== "connected") return;
    await refreshDir(ROOT_PAGES_DIR);
  }, [rpc, connectionStatus, refreshDir]);

  const setActiveWorkspace = useCallback(
    (workspace: SavedWorkspace) => {
      setActive(workspace.id);
      navigate(`/${workspace.slug}`);
    },
    [navigate, setActive],
  );

  const rootPages = getChildren(ROOT_PAGES_DIR);

  const value = useMemo(
    () => ({
      workspaces,
      activeWorkspace: workspaceFromUrl,
      connectionStatus,
      rpc,
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
      setActiveWorkspace,
      addWorkspace,
      updateWorkspace,
      removeWorkspace,
    }),
    [
      workspaces,
      workspaceFromUrl,
      connectionStatus,
      rpc,
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
      setActiveWorkspace,
      addWorkspace,
      updateWorkspace,
      removeWorkspace,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}

export function useWorkspaceOptional() {
  return useContext(WorkspaceContext);
}
