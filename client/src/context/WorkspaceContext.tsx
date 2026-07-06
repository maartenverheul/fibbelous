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
import { workspaceWsUrl } from "../lib/api";
import { createRpcClient, type RpcClient } from "../lib/rpc";
import type {
  SavedWorkspace,
  WorkspaceConnectionStatus,
} from "../types/workspace";
import {
  ROOT_PAGES_DIR,
  childrenDir,
  parentDirOfPage,
  parsePageIdFromSegment,
  type WorkspacePage,
  type WorkspacePageDetail,
  type TrashedPage,
  type TrashedPageDetail,
} from "../types/page";

type WorkspaceContextValue = {
  workspaces: SavedWorkspace[];
  activeWorkspace: SavedWorkspace | null;
  connectionStatus: WorkspaceConnectionStatus;
  rpc: RpcClient | null;
  rootPages: WorkspacePage[] | undefined;
  rootError: string | null;
  getChildren: (parentPath: string) => WorkspacePage[] | undefined;
  ensureChildren: (parentPath: string) => void;
  findPageByKey: (key: string) => WorkspacePage | undefined;
  findPageById: (id: string) => WorkspacePage | undefined;
  fetchPageById: (id: string) => Promise<WorkspacePage | null>;
  fetchPageDetail: (id: string) => Promise<WorkspacePageDetail | null>;
  fetchTrashedPageDetail: (id: string) => Promise<TrashedPageDetail | null>;
  createPage: (
    parentPage: WorkspacePage,
    init?: { title?: string; body?: string },
  ) => Promise<WorkspacePageDetail>;
  updatePage: (
    id: string,
    patch: { title?: string; body?: string; slug?: string; icon?: string | null },
  ) => Promise<WorkspacePageDetail>;
  duplicatePage: (id: string) => Promise<WorkspacePageDetail>;
  trashPage: (page: WorkspacePage) => Promise<string[]>;
  listTrashedPages: () => Promise<TrashedPage[]>;
  restorePage: (id: string) => Promise<WorkspacePageDetail>;
  purgePage: (id: string) => Promise<void>;
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
  setRootError: React.Dispatch<React.SetStateAction<string | null>>,
  loadedDirsRef: React.MutableRefObject<Set<string>>,
  inflightDirsRef: React.MutableRefObject<Set<string>>,
) {
  setChildrenByDir({});
  setPagesById({});
  setRootError(null);
  loadedDirsRef.current.clear();
  inflightDirsRef.current.clear();
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
  const [rootError, setRootError] = useState<string | null>(null);
  const loadedDirsRef = useRef(new Set<string>());
  const inflightDirsRef = useRef(new Set<string>());

  const workspaceFromUrl = slug ? (findBySlug(slug) ?? null) : null;

  useEffect(() => {
    if (!slug) return;

    if (!workspaceFromUrl) {
      if (activeWorkspace) {
        navigate(`/${activeWorkspace.slug}`, { replace: true });
      } else {
        navigate("/", { replace: true });
      }
      return;
    }

    if (activeWorkspace?.id !== workspaceFromUrl.id) {
      setActive(workspaceFromUrl.id);
    }
  }, [slug, workspaceFromUrl, activeWorkspace, navigate, setActive]);

  useEffect(() => {
    const workspace = workspaceFromUrl;
    if (!workspace) {
      setConnectionStatus("idle");
      setRpc(null);
      resetPageTree(
        setChildrenByDir,
        setPagesById,
        setRootError,
        loadedDirsRef,
        inflightDirsRef,
      );
      return;
    }

    setConnectionStatus("connecting");
    resetPageTree(
      setChildrenByDir,
      setPagesById,
      setRootError,
      loadedDirsRef,
      inflightDirsRef,
    );
    const client = createRpcClient(
      workspaceWsUrl(
        workspace.serverHost,
        workspace.serverPort,
        workspace.workspaceId,
      ),
    );
    setRpc(client);

    client
      .call("ping")
      .then(() => setConnectionStatus("connected"))
      .catch(() => setConnectionStatus("error"));

    return () => {
      client.close();
      setRpc(null);
      setConnectionStatus("disconnected");
      resetPageTree(
        setChildrenByDir,
        setPagesById,
        setRootError,
        loadedDirsRef,
        inflightDirsRef,
      );
    };
  }, [
    workspaceFromUrl?.id,
    workspaceFromUrl?.serverHost,
    workspaceFromUrl?.serverPort,
    workspaceFromUrl?.workspaceId,
  ]);

  const storePages = useCallback((parentPath: string, pages: WorkspacePage[]) => {
    setChildrenByDir((prev) => ({ ...prev, [parentPath]: pages }));
    setPagesById((prev) => {
      const next = { ...prev };
      for (const page of pages) {
        next[page.id] = page;
      }
      return next;
    });
  }, []);

  const refreshDir = useCallback(
    async (parentPath: string) => {
      if (!rpc || connectionStatus !== "connected") return [];
      const result = await rpc.call<WorkspacePage[]>("list_pages", { parentPath });
      loadedDirsRef.current.add(parentPath);
      storePages(parentPath, result);
      if (parentPath === ROOT_PAGES_DIR) {
        setRootError(null);
      }
      return result;
    },
    [rpc, connectionStatus, storePages],
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

  const removePageIdFromCache = useCallback((id: string) => {
    setPagesById((prev) => {
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

      rpc
        .call<WorkspacePage[]>("list_pages", { parentPath })
        .then((result) => {
          loadedDirsRef.current.add(parentPath);
          storePages(parentPath, result);
          if (parentPath === ROOT_PAGES_DIR) {
            setRootError(null);
          }
        })
        .catch((err) => {
          if (parentPath === ROOT_PAGES_DIR) {
            setRootError(
              err instanceof Error ? err.message : "Failed to load pages",
            );
          }
        })
        .finally(() => {
          inflightDirsRef.current.delete(parentPath);
        });
    },
    [rpc, connectionStatus, storePages],
  );

  useEffect(() => {
    if (!rpc || connectionStatus !== "connected") return;
    ensureChildren(ROOT_PAGES_DIR);
  }, [rpc, connectionStatus, ensureChildren]);

  const getChildren = useCallback(
    (parentPath: string) => childrenByDir[parentPath],
    [childrenByDir],
  );

  const findPageById = useCallback(
    (id: string) => {
      const cached = pagesById[id];
      if (cached) return cached;

      for (const pages of Object.values(childrenByDir)) {
        const match = pages.find((page) => page.id === id);
        if (match) return match;
      }

      return undefined;
    },
    [childrenByDir, pagesById],
  );

  const findPageByKey = useCallback(
    (segment: string) => {
      const pageId = parsePageIdFromSegment(segment);
      if (!pageId) return undefined;
      return findPageById(pageId);
    },
    [findPageById],
  );

  const fetchPageById = useCallback(
    async (id: string) => {
      const cached = pagesById[id];
      if (cached) return cached;
      if (!rpc || connectionStatus !== "connected") return null;

      const detail = await rpc.call<WorkspacePageDetail | null>("get_page", { id });
      if (!detail) return null;

      const { body: _body, ...page } = detail;
      setPagesById((prev) => ({ ...prev, [page.id]: page }));
      ensureChildren(parentDirOfPage(page));
      return page;
    },
    [pagesById, rpc, connectionStatus, ensureChildren],
  );

  const fetchPageDetail = useCallback(
    async (id: string) => {
      if (!rpc || connectionStatus !== "connected") return null;

      const detail = await rpc.call<WorkspacePageDetail | null>("get_page", { id });
      if (!detail) return null;

      const { body: _body, ...page } = detail;
      setPagesById((prev) => ({ ...prev, [page.id]: page }));
      ensureChildren(parentDirOfPage(page));
      return detail;
    },
    [rpc, connectionStatus, ensureChildren],
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

      const { body: _body, ...page } = detail;
      setPagesById((prev) => ({ ...prev, [page.id]: page }));
      await invalidateAndRefreshDirs(parentPath, parentDirOfPage(parentPage));
      return detail;
    },
    [rpc, connectionStatus, invalidateAndRefreshDirs],
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

      const { body: _body, ...page } = detail;
      setPagesById((prev) => ({ ...prev, [page.id]: page }));
      await invalidateAndRefreshDirs(parentDirOfPage(page));
      return detail;
    },
    [rpc, connectionStatus, invalidateAndRefreshDirs],
  );

  const duplicatePage = useCallback(
    async (id: string) => {
      if (!rpc || connectionStatus !== "connected") {
        throw new Error("Workspace not connected");
      }

      const detail = await rpc.call<WorkspacePageDetail>("duplicate_page", { id });
      const { body: _body, ...page } = detail;
      setPagesById((prev) => ({ ...prev, [page.id]: page }));
      await invalidateAndRefreshDirs(parentDirOfPage(page));
      return detail;
    },
    [rpc, connectionStatus, invalidateAndRefreshDirs],
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

  const restorePage = useCallback(
    async (id: string) => {
      if (!rpc || connectionStatus !== "connected") {
        throw new Error("Workspace not connected");
      }

      const detail = await rpc.call<WorkspacePageDetail>("restore_page", { id });
      const { body: _body, ...page } = detail;
      setPagesById((prev) => ({ ...prev, [page.id]: page }));
      await invalidateAndRefreshDirs(parentDirOfPage(page));
      return detail;
    },
    [rpc, connectionStatus, invalidateAndRefreshDirs],
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

  const setActiveWorkspace = useCallback(
    (workspace: SavedWorkspace) => {
      setActive(workspace.id);
      navigate(`/${workspace.slug}`);
    },
    [navigate, setActive],
  );

  const rootPages = childrenByDir[ROOT_PAGES_DIR];

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
