import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSavedWorkspaces } from "../../hooks/useSavedWorkspaces";
import type { SavedWorkspace } from "../../types/workspace";

export type WorkspaceSessionValue = {
  workspaces: SavedWorkspace[];
  activeWorkspace: SavedWorkspace | null;
  setActiveWorkspace: (workspace: SavedWorkspace) => void;
  addWorkspace: ReturnType<typeof useSavedWorkspaces>["addWorkspace"];
  updateWorkspace: ReturnType<typeof useSavedWorkspaces>["updateWorkspace"];
  removeWorkspace: ReturnType<typeof useSavedWorkspaces>["removeWorkspace"];
  setActive: ReturnType<typeof useSavedWorkspaces>["setActive"];
  suppressActiveSyncRef: RefObject<boolean>;
};

const WorkspaceSessionContext = createContext<WorkspaceSessionValue | null>(
  null,
);

export function WorkspaceSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const {
    workspaces,
    activeWorkspace: savedActiveWorkspace,
    addWorkspace,
    updateWorkspace,
    removeWorkspace,
    setActive,
    findBySlug,
  } = useSavedWorkspaces();

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
        savedActiveWorkspace?.id !== workspaceFromUrl.id
      ) {
        setActive(workspaceFromUrl.id);
      }
      return;
    }

    if (savedActiveWorkspace) {
      navigate(`/${savedActiveWorkspace.slug}`, { replace: true });
      return;
    }

    if (resolvedSlugRef.current !== slug) {
      navigate("/", { replace: true });
    }
  }, [slug, workspaceFromUrl, savedActiveWorkspace, navigate, setActive]);

  const setActiveWorkspace = useCallback(
    (workspace: SavedWorkspace) => {
      setActive(workspace.id);
      navigate(`/${workspace.slug}`);
    },
    [navigate, setActive],
  );

  const value = useMemo(
    () => ({
      workspaces,
      activeWorkspace: workspaceFromUrl,
      setActiveWorkspace,
      addWorkspace,
      updateWorkspace,
      removeWorkspace,
      setActive,
      suppressActiveSyncRef,
    }),
    [
      workspaces,
      workspaceFromUrl,
      setActiveWorkspace,
      addWorkspace,
      updateWorkspace,
      removeWorkspace,
      setActive,
    ],
  );

  return (
    <WorkspaceSessionContext.Provider value={value}>
      {children}
    </WorkspaceSessionContext.Provider>
  );
}

export function useWorkspaceSession() {
  const context = useContext(WorkspaceSessionContext);
  if (!context) {
    throw new Error(
      "useWorkspaceSession must be used within WorkspaceSessionProvider",
    );
  }
  return context;
}

export function useWorkspaceSessionOptional() {
  return useContext(WorkspaceSessionContext);
}
