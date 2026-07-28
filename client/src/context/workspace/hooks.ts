import { useMemo } from "react";
import type { RpcClient } from "../../lib/api/rpc";
import type { SavedWorkspace } from "../../lib/api/workspace";
import type { WorkspaceConnectionStatus } from "../../lib/api/workspace";
import type { useSavedWorkspaces } from "../../hooks/useSavedWorkspaces";
import type {
  BodyPatch,
  SearchPageHit,
  TrashedPage,
  TrashedPageDetail,
  WorkspacePage,
  WorkspacePageDetail,
} from "../../lib/page/types";
import type {
  CreateDatabaseResult,
  WorkspaceDatabaseMeta,
} from "../../lib/database/types";
import {
  useWorkspaceConnection,
  useWorkspaceConnectionOptional,
} from "./WorkspaceConnectionProvider";
import {
  useWorkspacePagesContext,
  useWorkspacePagesContextOptional,
} from "./WorkspacePagesProvider";
import {
  useWorkspaceSession,
  useWorkspaceSessionOptional,
} from "./WorkspaceSessionProvider";

export type WorkspaceContextValue = {
  workspaces: SavedWorkspace[];
  activeWorkspace: SavedWorkspace | null;
  connectionStatus: WorkspaceConnectionStatus;
  rpc: RpcClient | null;
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
  createDatabase: (options?: {
    title?: string;
    parentId?: string;
  }) => Promise<CreateDatabaseResult>;
  listDatabases: () => Promise<WorkspaceDatabaseMeta[]>;
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
  setPageFavorite: (
    id: string,
    favorite: boolean,
  ) => Promise<WorkspacePageDetail>;
  duplicatePage: (id: string) => Promise<WorkspacePageDetail>;
  trashPage: (page: WorkspacePage) => Promise<string[]>;
  searchPages: (query: string) => Promise<SearchPageHit[]>;
  listTrashedPages: () => Promise<TrashedPage[]>;
  restorePage: (id: string) => Promise<WorkspacePageDetail>;
  purgePage: (id: string) => Promise<void>;
  reloadPages: () => Promise<void>;
  draftTitlesById: Record<string, string>;
  setPageDraftTitle: (id: string, title: string | null) => void;
  setActiveWorkspace: (workspace: SavedWorkspace) => void;
  addWorkspace: ReturnType<typeof useSavedWorkspaces>["addWorkspace"];
  updateWorkspace: ReturnType<typeof useSavedWorkspaces>["updateWorkspace"];
  removeWorkspace: ReturnType<typeof useSavedWorkspaces>["removeWorkspace"];
};

export function useWorkspace(): WorkspaceContextValue {
  const session = useWorkspaceSession();
  const connection = useWorkspaceConnection();
  const pages = useWorkspacePagesContext();

  return useMemo(
    () => ({
      workspaces: session.workspaces,
      activeWorkspace: session.activeWorkspace,
      setActiveWorkspace: session.setActiveWorkspace,
      addWorkspace: session.addWorkspace,
      updateWorkspace: session.updateWorkspace,
      removeWorkspace: session.removeWorkspace,
      connectionStatus: connection.connectionStatus,
      rpc: connection.rpc,
      ...pages,
    }),
    [session, connection, pages],
  );
}

export function useWorkspaceOptional(): WorkspaceContextValue | null {
  const session = useWorkspaceSessionOptional();
  const connection = useWorkspaceConnectionOptional();
  const pages = useWorkspacePagesContextOptional();

  return useMemo(() => {
    if (!session || !connection || !pages) return null;
    return {
      workspaces: session.workspaces,
      activeWorkspace: session.activeWorkspace,
      setActiveWorkspace: session.setActiveWorkspace,
      addWorkspace: session.addWorkspace,
      updateWorkspace: session.updateWorkspace,
      removeWorkspace: session.removeWorkspace,
      connectionStatus: connection.connectionStatus,
      rpc: connection.rpc,
      ...pages,
    };
  }, [session, connection, pages]);
}
