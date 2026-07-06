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
  parentDirOfPage,
  parsePageIdFromSegment,
  type WorkspacePage,
  type WorkspacePageDetail,
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
