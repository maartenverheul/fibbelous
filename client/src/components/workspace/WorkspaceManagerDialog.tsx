import { useEffect, useId, useRef, useState } from "react";
import { PiFolder, PiX } from "react-icons/pi";
import { EmojiIcon } from "../emoji/EmojiIcon";
import { EmojiIconPicker } from "../emoji/EmojiIconPicker";
import { useNavigate } from "react-router-dom";
import useLocalStorageState from "use-local-storage-state";
import { useSavedWorkspaces } from "../../hooks/useSavedWorkspaces";
import {
  checkServerHealth,
  cloneWorkspace,
  createWorkspace,
  fetchWorkspaces,
  isWorkspaceNotFoundError,
  reindexLocalWorkspace,
  reindexRemoteWorkspace,
  updateWorkspaceSettings,
  verifyLocalWorkspaceConnection,
  verifySavedWorkspaceConnection,
} from "../../lib/api/api";
import {
  DEFAULT_SERVER_URL,
  normalizeServerUrl,
  parseServerUrl,
} from "../../lib/api/serverAddress";
import { cn, formatUnknownError } from "../../lib/utils";
import {
  isTauri,
  cloneLocalWorkspace,
  openLocalWorkspace,
  pickCloneParentFolder,
  pickWorkspaceFolder,
  updateLocalWorkspaceSettings,
} from "../../lib/api/tauri";
import { workspaceNoticeMessage, type WorkspaceNotice } from "../../lib/app/navigation";
import { buildRestoredWorkspacePath } from "../../lib/app/lastRouteStorage";
import { slugifyPageTitle } from "../../lib/page/types";
import {
  isLocalWorkspace,
  type IndexStatus,
  type SavedWorkspace,
  type WorkspaceInfo,
} from "../../lib/api/workspace";
import { useWorkspaceOptional } from "../../context/WorkspaceContext";

export type WorkspaceManagerTab = "browse" | "settings";

type WorkspaceManagerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: WorkspaceManagerTab;
  focusSavedWorkspaceId?: string | null;
  notice?: WorkspaceNotice | null;
};

type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

const inputClassName = cn(
  "w-full rounded-md border border-app-border bg-app-surface px-2.5 py-1.5 text-base text-stone-900 placeholder:text-stone-500 dark:text-stone-50 dark:placeholder:text-stone-500",
);

const labelClassName = cn(
  "text-xs font-medium text-stone-600 dark:text-stone-400",
);

const buttonPrimaryClassName = cn(
  "rounded-md bg-stone-800 px-3 py-1.5 text-sm font-medium text-stone-50",
  "hover:bg-stone-700 disabled:opacity-50",
  "dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-stone-100",
);

const buttonSecondaryClassName = cn(
  "rounded-md border border-app-border bg-app-surface px-3 py-1.5 text-sm text-stone-900",
  "hover:bg-stone-100 dark:text-stone-50 dark:hover:bg-stone-800",
);

function WorkspaceIcon({ icon }: { icon?: string }) {
  if (icon) return <EmojiIcon icon={icon} size={20} />;
  return <PiFolder className="h-5 w-5" aria-hidden />;
}

function indexStatusLabel(status: IndexStatus) {
  switch (status) {
    case "pending":
      return "Pending";
    case "indexing":
      return "Indexing";
    case "ready":
      return "Ready";
    case "failed":
      return "Failed";
  }
}

function indexStatusClassName(status: IndexStatus) {
  switch (status) {
    case "ready":
      return "text-green-700 dark:text-green-400";
    case "failed":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-stone-500 dark:text-stone-400";
  }
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-stone-800 text-stone-50 dark:bg-stone-200 dark:text-stone-900"
          : "text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800",
      )}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1">
      <span className={labelClassName}>{label}</span>
      {children}
    </label>
  );
}

export function WorkspaceManagerDialog({
  open,
  onOpenChange,
  initialTab = "browse",
  focusSavedWorkspaceId = null,
  notice = null,
}: WorkspaceManagerProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    addWorkspace,
    updateWorkspace,
    removeWorkspace,
    setActive,
    isBookmarked,
  } = useSavedWorkspaces();
  const workspaceContext = useWorkspaceOptional();
  const navigate = useNavigate();
  const [lastServer, setLastServer] = useLocalStorageState<string | null>(
    "fibbelous.lastServer",
    { defaultValue: null },
  );

  const [activeTab, setActiveTab] = useState<WorkspaceManagerTab>(initialTab);
  const [settingsWorkspaceId, setSettingsWorkspaceId] = useState<string | null>(
    null,
  );

  const [serverAddress, setServerAddress] = useState(DEFAULT_SERVER_URL);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [remoteWorkspaces, setRemoteWorkspaces] = useState<WorkspaceInfo[]>(
    [],
  );

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createIcon, setCreateIcon] = useState("");
  const [createSlugEdited, setCreateSlugEdited] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [settingsName, setSettingsName] = useState("");
  const [settingsSlug, setSettingsSlug] = useState("");
  const [settingsIcon, setSettingsIcon] = useState("");
  const [settingsLabel, setSettingsLabel] = useState("");
  const [settingsAddress, setSettingsAddress] = useState("");
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsReindexing, setSettingsReindexing] = useState(false);
  const [localNotice, setLocalNotice] = useState<WorkspaceNotice | null>(null);
  const [openingWorkspaceId, setOpeningWorkspaceId] = useState<string | null>(
    null,
  );
  const [openingFolder, setOpeningFolder] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);

  const [showCloneForm, setShowCloneForm] = useState(false);
  const [cloneUrl, setCloneUrl] = useState("");
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [cloning, setCloning] = useState(false);

  const activeNotice = localNotice ?? notice;
  const showUseFolder = isTauri();

  const settingsWorkspace =
    workspaces.find((workspace) => workspace.id === settingsWorkspaceId) ??
    null;

  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }

    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    setActiveTab(initialTab);
    setSettingsWorkspaceId(
      focusSavedWorkspaceId ?? activeWorkspaceId ?? workspaces[0]?.id ?? null,
    );

    const serverSource =
      activeWorkspace ??
      (focusSavedWorkspaceId
        ? workspaces.find((workspace) => workspace.id === focusSavedWorkspaceId)
        : null);

    if (serverSource && !isLocalWorkspace(serverSource)) {
      setServerAddress(serverSource.serverUrl);
    } else if (lastServer) {
      setServerAddress(lastServer);
    }

    setConnectionStatus("idle");
    setConnectionError(null);
    setRemoteWorkspaces([]);
    setShowCreateForm(false);
    setCreateName("");
    setCreateSlug("");
    setCreateIcon("");
    setCreateSlugEdited(false);
    setCreateError(null);
    setSettingsError(null);
    setFolderError(null);
    setLocalNotice(notice ?? null);
  }, [
    open,
    initialTab,
    focusSavedWorkspaceId,
    notice,
    activeWorkspace,
    activeWorkspaceId,
    workspaces,
    lastServer,
  ]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    if (!open || !focusSavedWorkspaceId) return;
    setSettingsWorkspaceId(focusSavedWorkspaceId);
  }, [open, focusSavedWorkspaceId]);

  useEffect(() => {
    if (!settingsWorkspace) return;
    setSettingsName(settingsWorkspace.label);
    setSettingsSlug(settingsWorkspace.slug);
    setSettingsIcon(settingsWorkspace.icon ?? "");
    setSettingsLabel(settingsWorkspace.label);
    setSettingsAddress(
      isLocalWorkspace(settingsWorkspace) ? "" : settingsWorkspace.serverUrl,
    );
    setSettingsError(null);
    // Reset the form when switching workspace or reopening, not when
    // the bookmark is patched in place (e.g. after reindex reloads workspace.json).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [settingsWorkspaceId, open]);

  const parsedServer = parseServerUrl(serverAddress);
  const serverUrl =
    "error" in parsedServer
      ? null
      : normalizeServerUrl(parsedServer);

  const handleOpenFailure = (
    label: string,
    error: unknown,
    savedBookmark?: SavedWorkspace | null,
  ) => {
    if (isWorkspaceNotFoundError(error)) {
      if (savedBookmark) {
        removeWorkspace(savedBookmark.id);
        if (settingsWorkspaceId === savedBookmark.id) {
          setSettingsWorkspaceId(
            workspaces.find((workspace) => workspace.id !== savedBookmark.id)
              ?.id ?? null,
          );
        }
      }
      setActiveTab("browse");
      setLocalNotice({ kind: "missing", label });
      return;
    }
    setLocalNotice({ kind: "connectionFailed", label });
  };

  const openWorkspace = async (workspace: WorkspaceInfo) => {
    if (!serverUrl) return;

    setLocalNotice(null);
    setOpeningWorkspaceId(workspace.id);

    const existing = workspaces.find(
      (item) =>
        item.serverUrl === serverUrl && item.workspaceId === workspace.id,
    );

    try {
      await verifySavedWorkspaceConnection(serverUrl, workspace.id);

      if (existing) {
        setActive(existing.id);
        navigate(buildRestoredWorkspacePath(existing));
      } else {
        const saved: SavedWorkspace = {
          id: crypto.randomUUID(),
          label: workspace.title,
          serverUrl,
          workspaceId: workspace.id,
          slug: workspace.slug,
          icon: workspace.icon,
        };
        addWorkspace(saved);
        setActive(saved.id);
        navigate(buildRestoredWorkspacePath(saved));
      }

      onOpenChange(false);
    } catch (error) {
      handleOpenFailure(existing?.label ?? workspace.title, error, existing);
      if (isWorkspaceNotFoundError(error)) {
        setRemoteWorkspaces((prev) =>
          prev.filter((item) => item.id !== workspace.id),
        );
      }
    } finally {
      setOpeningWorkspaceId(null);
    }
  };

  const openSavedWorkspace = async (workspace: SavedWorkspace) => {
    setLocalNotice(null);
    setOpeningWorkspaceId(workspace.id);

    try {
      if (isLocalWorkspace(workspace) && workspace.localPath) {
        await verifyLocalWorkspaceConnection(
          workspace.localPath,
          workspace.workspaceId,
        );
      } else {
        await verifySavedWorkspaceConnection(
          workspace.serverUrl,
          workspace.workspaceId,
        );
      }
      setActive(workspace.id);
      navigate(buildRestoredWorkspacePath(workspace));
      onOpenChange(false);
    } catch (error) {
      handleOpenFailure(workspace.label, error, workspace);
    } finally {
      setOpeningWorkspaceId(null);
    }
  };

  const handleConnect = async () => {
    setConnectionError(null);

    if ("error" in parsedServer) {
      setConnectionStatus("error");
      setConnectionError(parsedServer.error);
      return;
    }

    const url = normalizeServerUrl(parsedServer);
    setServerAddress(url);
    setConnectionStatus("connecting");

    try {
      await checkServerHealth(url);
      const results = await fetchWorkspaces(url);
      setRemoteWorkspaces(results);
      setConnectionStatus("connected");
      setLastServer(url);
    } catch (error) {
      setConnectionStatus("error");
      setConnectionError(
        error instanceof Error ? error.message : "Connection failed",
      );
      setRemoteWorkspaces([]);
    }
  };

  const openLocalFolderWorkspace = async (
    path: string,
    info: WorkspaceInfo,
  ) => {
    const existing = workspaces.find(
      (item) => item.localPath === path || item.workspaceId === info.id,
    );

    if (existing) {
      setActive(existing.id);
      navigate(buildRestoredWorkspacePath(existing));
    } else {
      const saved: SavedWorkspace = {
        id: crypto.randomUUID(),
        label: info.title,
        serverUrl: "",
        workspaceId: info.id,
        slug: info.slug,
        icon: info.icon,
        localPath: path,
      };
      addWorkspace(saved);
      setActive(saved.id);
      navigate(buildRestoredWorkspacePath(saved));
    }

    onOpenChange(false);
  };

  const handleUseFolder = async () => {
    if (!showUseFolder) return;

    setFolderError(null);
    setLocalNotice(null);
    setOpeningFolder(true);

    try {
      const path = await pickWorkspaceFolder();
      if (!path) return;

      const workspace = await openLocalWorkspace(path);
      await openLocalFolderWorkspace(path, workspace);
    } catch (error) {
      setFolderError(formatUnknownError(error, "Failed to open folder"));
    } finally {
      setOpeningFolder(false);
    }
  };

  const handleCreate = async () => {
    setCreateError(null);

    if (!serverUrl) {
      setCreateError("Connect to a server first");
      return;
    }

    const title = createName.trim();
    if (!title) {
      setCreateError("Title is required");
      return;
    }

    setCreating(true);
    try {
      const workspace = await createWorkspace(serverUrl, {
        title,
        slug: createSlug.trim() || undefined,
        icon: createIcon.trim() || undefined,
      });
      setRemoteWorkspaces((prev) => [...prev, workspace]);
      openWorkspace(workspace);
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Failed to create workspace",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleCloneRemote = async () => {
    setCloneError(null);

    if (!serverUrl) {
      setCloneError("Connect to a server first");
      return;
    }

    const url = cloneUrl.trim();
    if (!url) {
      setCloneError("Repository URL is required");
      return;
    }

    setCloning(true);
    try {
      const workspace = await cloneWorkspace(serverUrl, { url });
      setRemoteWorkspaces((prev) => [...prev, workspace]);
      setCloneUrl("");
      setShowCloneForm(false);
      openWorkspace(workspace);
    } catch (error) {
      setCloneError(
        error instanceof Error ? error.message : "Failed to clone repository",
      );
    } finally {
      setCloning(false);
    }
  };

  const handleCloneLocal = async () => {
    if (!showUseFolder) return;

    setCloneError(null);
    const url = cloneUrl.trim();
    if (!url) {
      setCloneError("Repository URL is required");
      return;
    }

    setCloning(true);
    try {
      const parentPath = await pickCloneParentFolder();
      if (!parentPath) return;

      const workspace = await cloneLocalWorkspace(url, parentPath);
      setCloneUrl("");
      setShowCloneForm(false);
      await openLocalFolderWorkspace(workspace.path, workspace);
    } catch (error) {
      setCloneError(
        formatUnknownError(error, "Failed to clone repository"),
      );
    } finally {
      setCloning(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settingsWorkspace) return;

    setSettingsError(null);
    setSettingsSaving(true);

    const title = settingsName.trim();
    const slug = settingsSlug.trim();
    if (!title) {
      setSettingsError("Workspace title is required");
      setSettingsSaving(false);
      return;
    }
    if (!slug) {
      setSettingsError("Slug is required");
      setSettingsSaving(false);
      return;
    }

    try {
      if (isLocalWorkspace(settingsWorkspace)) {
        if (settingsWorkspace.localPath) {
          await openLocalWorkspace(settingsWorkspace.localPath);
        }
        const updated = await updateLocalWorkspaceSettings(
          settingsWorkspace.workspaceId,
          {
            title,
            slug,
            icon: settingsIcon.trim(),
          },
        );
        const label = settingsLabel.trim() || updated.title;
        updateWorkspace(settingsWorkspace.id, {
          label,
          slug: updated.slug,
          icon: updated.icon,
        });

        if (
          activeWorkspaceId === settingsWorkspace.id &&
          updated.slug !== settingsWorkspace.slug
        ) {
          navigate(`/${updated.slug}`, { replace: true });
        }
        return;
      }

      const parsedSettings = parseServerUrl(settingsAddress);
      if ("error" in parsedSettings) {
        setSettingsError(parsedSettings.error);
        return;
      }

      const url = normalizeServerUrl(parsedSettings);
      setSettingsAddress(url);

      const updated = await updateWorkspaceSettings(
        url,
        settingsWorkspace.workspaceId,
        {
          title,
          slug,
          icon: settingsIcon.trim(),
        },
      );

      const label = settingsLabel.trim() || updated.title;
      updateWorkspace(settingsWorkspace.id, {
        label,
        slug: updated.slug,
        icon: updated.icon,
        serverUrl: url,
      });

      setRemoteWorkspaces((prev) =>
        prev.map((workspace) =>
          workspace.id === updated.id ? updated : workspace,
        ),
      );

      if (activeWorkspaceId === settingsWorkspace.id && updated.slug !== settingsWorkspace.slug) {
        navigate(`/${updated.slug}`, { replace: true });
      }
    } catch (error) {
      if (isWorkspaceNotFoundError(error)) {
        const removedId = settingsWorkspace.id;
        removeWorkspace(removedId);
        setActiveTab("browse");
        setLocalNotice({
          kind: "missing",
          label: settingsWorkspace.label,
        });
        setSettingsWorkspaceId(
          workspaces.find((workspace) => workspace.id !== removedId)?.id ?? null,
        );
        return;
      }
      setSettingsError(
        error instanceof Error ? error.message : "Failed to save settings",
      );
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleReindex = async () => {
    if (!settingsWorkspace) return;

    setSettingsError(null);
    setSettingsReindexing(true);

    try {
      let updated: WorkspaceInfo;

      if (isLocalWorkspace(settingsWorkspace)) {
        if (!settingsWorkspace.localPath) {
          setSettingsError("Local workspace folder is missing");
          return;
        }
        updated = await reindexLocalWorkspace(
          settingsWorkspace.localPath,
          settingsWorkspace.workspaceId,
        );
      } else {
        const parsedSettings = parseServerUrl(settingsAddress);
        if ("error" in parsedSettings) {
          setSettingsError(parsedSettings.error);
          return;
        }
        updated = await reindexRemoteWorkspace(
          normalizeServerUrl(parsedSettings),
          settingsWorkspace.workspaceId,
        );
      }

      setRemoteWorkspaces((prev) =>
        prev.map((workspace) =>
          workspace.id === updated.id ? updated : workspace,
        ),
      );

      setSettingsName(updated.title);
      setSettingsSlug(updated.slug);
      setSettingsIcon(updated.icon ?? "");

      updateWorkspace(settingsWorkspace.id, {
        slug: updated.slug,
        icon: updated.icon,
      });

      if (
        activeWorkspaceId === settingsWorkspace.id &&
        updated.slug !== settingsWorkspace.slug
      ) {
        navigate(`/${updated.slug}`, { replace: true });
      }

      if (
        workspaceContext &&
        activeWorkspaceId === settingsWorkspace.id &&
        workspaceContext.activeWorkspace?.id === settingsWorkspace.id
      ) {
        await workspaceContext.reloadPages();
      }
    } catch (error) {
      if (isWorkspaceNotFoundError(error)) {
        const removedId = settingsWorkspace.id;
        removeWorkspace(removedId);
        setActiveTab("browse");
        setLocalNotice({
          kind: "missing",
          label: settingsWorkspace.label,
        });
        setSettingsWorkspaceId(
          workspaces.find((workspace) => workspace.id !== removedId)?.id ?? null,
        );
        return;
      }
      setSettingsError(
        error instanceof Error ? error.message : "Failed to reindex workspace",
      );
    } finally {
      setSettingsReindexing(false);
    }
  };

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      tabIndex={-1}
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-app-bg text-stone-900 outline-none",
        "dark:text-stone-50",
      )}
    >
      <header
        className={cn(
          "shrink-0 border-b border-app-border bg-app-surface",
          "pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]",
        )}
      >
        <div className="mx-auto flex w-full max-w-xl items-start justify-between gap-3 pb-3">
          <div className="min-w-0">
            <h1 id={titleId} className="text-lg font-semibold">
              Workspaces
            </h1>
            <p
              id={descriptionId}
              className="mt-1 text-sm text-stone-600 dark:text-stone-400"
            >
              {activeTab === "browse"
                ? "Connect to your server, then open or create a workspace."
                : "Edit workspace details and connection settings."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md px-2 py-1 text-stone-500 hover:bg-stone-100 hover:text-stone-800 dark:hover:bg-stone-800 dark:hover:text-stone-200"
            aria-label="Close"
          >
            <PiX className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </header>

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          "pr-[max(0px,env(safe-area-inset-right))] pl-[max(0px,env(safe-area-inset-left))]",
          "pb-[max(1.5rem,env(safe-area-inset-bottom))]",
        )}
      >
        <div className="mx-auto w-full max-w-xl px-4 pt-4">
          <div className="flex gap-1 rounded-lg bg-stone-100 p-1 dark:bg-stone-900">
            <TabButton
              active={activeTab === "browse"}
              onClick={() => setActiveTab("browse")}
            >
              Browse
            </TabButton>
            <TabButton
              active={activeTab === "settings"}
              onClick={() => setActiveTab("settings")}
            >
              Settings
            </TabButton>
          </div>

          {activeNotice && (
            <p
              role="status"
              className={cn(
                "mt-4 rounded-md border px-3 py-2 text-sm",
                activeNotice.kind === "missing"
                  ? "border-amber-300/80 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
                  : "border-red-300/80 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100",
              )}
            >
              {workspaceNoticeMessage(activeNotice)}
            </p>
          )}

          {activeTab === "browse" ? (
            <div className="mt-5 space-y-5">
              <section className="rounded-lg border border-app-border bg-app-surface p-3">
                <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[1fr_auto]">
                  <Field label="Server">
                    <input
                      value={serverAddress}
                      onChange={(event) => setServerAddress(event.target.value)}
                      className={inputClassName}
                      placeholder={DEFAULT_SERVER_URL}
                    />
                  </Field>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={connectionStatus === "connecting"}
                      className={cn(buttonPrimaryClassName, "w-full sm:w-auto")}
                    >
                      {connectionStatus === "connecting" ? "..." : "Connect"}
                    </button>
                  </div>
                </div>
                {connectionStatus === "connected" && (
                  <p className="mt-2 text-xs text-green-700 dark:text-green-400">
                    Connected to {serverUrl}
                  </p>
                )}
                {connectionError && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {connectionError}
                  </p>
                )}
                {showUseFolder && (
                  <div className="mt-3 flex flex-col gap-2 border-t border-app-border pt-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <button
                      type="button"
                      onClick={() => void handleUseFolder()}
                      disabled={openingFolder}
                      className={cn(buttonSecondaryClassName, "w-full sm:w-auto")}
                    >
                      {openingFolder ? "Opening..." : "Use folder"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCloneForm((value) => !value);
                        setCloneError(null);
                      }}
                      className={cn(buttonSecondaryClassName, "w-full sm:w-auto")}
                    >
                      {showCloneForm ? "Cancel clone" : "Clone repository"}
                    </button>
                    <p className="text-xs text-stone-600 dark:text-stone-400 sm:basis-full">
                      Open or create a workspace from a local folder (no server).
                    </p>
                  </div>
                )}
                {showUseFolder && showCloneForm && (
                  <div className="mt-3 grid gap-2 border-t border-app-border pt-3">
                    <Field label="Git repository URL">
                      <input
                        value={cloneUrl}
                        onChange={(event) => setCloneUrl(event.target.value)}
                        className={inputClassName}
                        placeholder="git@github.com:org/workspace.git"
                      />
                    </Field>
                    {cloneError && (
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {cloneError}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleCloneLocal()}
                      disabled={cloning}
                      className={cn(buttonPrimaryClassName, "self-start")}
                    >
                      {cloning ? "Cloning..." : "Clone into folder…"}
                    </button>
                  </div>
                )}
                {folderError && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {folderError}
                  </p>
                )}
              </section>

              {connectionStatus === "connected" && (
                <section className="space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-sm font-medium text-stone-800 dark:text-stone-200">
                      On this server
                    </h2>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCloneForm((value) => !value);
                          setCloneError(null);
                        }}
                        className="text-sm text-stone-700 hover:underline dark:text-stone-300"
                      >
                        {showCloneForm ? "Cancel" : "Clone repository"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCreateForm((value) => !value)}
                        className="text-sm text-stone-700 hover:underline dark:text-stone-300"
                      >
                        {showCreateForm ? "Cancel" : "+ New workspace"}
                      </button>
                    </div>
                  </div>

                  {showCloneForm && (
                    <div className="grid gap-3 rounded-lg border border-app-border bg-app-surface p-3">
                      <Field label="Git repository URL">
                        <input
                          value={cloneUrl}
                          onChange={(event) => setCloneUrl(event.target.value)}
                          className={inputClassName}
                          placeholder="https://github.com/org/workspace.git"
                        />
                      </Field>
                      {cloneError && (
                        <p className="text-sm text-red-600 dark:text-red-400">
                          {cloneError}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleCloneRemote()}
                        disabled={cloning}
                        className={cn(buttonPrimaryClassName, "self-start")}
                      >
                        {cloning ? "Cloning..." : "Clone & open"}
                      </button>
                    </div>
                  )}

                  {showCreateForm && (
                    <div className="grid gap-3 rounded-lg border border-app-border bg-app-surface p-3">
                      <div className="grid grid-cols-[3rem_1fr] gap-2">
                        <div className="grid gap-1">
                          <span className={labelClassName}>Icon</span>
                          <EmojiIconPicker
                            icon={createIcon || null}
                            onSelect={setCreateIcon}
                          />
                        </div>
                        <Field label="Title">
                          <input
                            value={createName}
                            onChange={(event) => {
                              const value = event.target.value;
                              setCreateName(value);
                              if (!createSlugEdited) {
                                setCreateSlug(slugifyPageTitle(value));
                              }
                            }}
                            className={inputClassName}
                            placeholder="My workspace"
                          />
                        </Field>
                      </div>
                      <Field label="Slug">
                        <input
                          value={createSlug}
                          onChange={(event) => {
                            setCreateSlug(event.target.value);
                            setCreateSlugEdited(true);
                          }}
                          className={inputClassName}
                          placeholder="my-workspace"
                        />
                      </Field>
                      {createError && (
                        <p className="text-sm text-red-600 dark:text-red-400">
                          {createError}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={handleCreate}
                        disabled={creating}
                        className={cn(buttonPrimaryClassName, "self-start")}
                      >
                        {creating ? "Creating..." : "Create & open"}
                      </button>
                    </div>
                  )}

                  {remoteWorkspaces.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-app-border px-3 py-6 text-center text-sm text-stone-600 dark:text-stone-400">
                      No workspaces on this server yet.
                    </p>
                  ) : (
                    <ul className="grid gap-2">
                      {remoteWorkspaces.map((workspace) => (
                        <li
                          key={workspace.id}
                          className="flex flex-col gap-3 rounded-lg border border-app-border bg-app-surface px-3 py-2.5 sm:flex-row sm:items-center"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-200/80 text-lg dark:bg-stone-800">
                              <WorkspaceIcon icon={workspace.icon} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">
                                {workspace.title}
                              </p>
                              <p className="truncate text-xs text-stone-600 dark:text-stone-400">
                                /{workspace.slug}
                                <span
                                  className={cn(
                                    "ml-2",
                                    indexStatusClassName(workspace.indexStatus),
                                  )}
                                >
                                  {indexStatusLabel(workspace.indexStatus)}
                                </span>
                                {serverUrl &&
                                  isBookmarked(serverUrl, workspace.id) &&
                                  " · Saved"}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void openWorkspace(workspace)}
                            disabled={openingWorkspaceId === workspace.id}
                            className={cn(
                              buttonPrimaryClassName,
                              "w-full sm:w-auto",
                            )}
                          >
                            {openingWorkspaceId === workspace.id
                              ? "Opening..."
                              : "Open"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {workspaces.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-sm font-medium text-stone-800 dark:text-stone-200">
                    Saved on this device
                  </h2>
                  <ul className="grid gap-2">
                    {workspaces.map((workspace) => (
                      <li
                        key={workspace.id}
                        className="flex flex-col gap-3 rounded-lg border border-app-border bg-app-surface px-3 py-2.5 sm:flex-row sm:items-center"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-200/80 text-lg dark:bg-stone-800">
                            <WorkspaceIcon icon={workspace.icon} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {workspace.label}
                            </p>
                            <p className="truncate text-xs text-stone-600 dark:text-stone-400">
                              {isLocalWorkspace(workspace)
                                ? workspace.localPath
                                : `${workspace.serverUrl} · /${workspace.slug}`}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSettingsWorkspaceId(workspace.id);
                              setActiveTab("settings");
                            }}
                            className={cn(buttonSecondaryClassName, "w-full")}
                          >
                            Settings
                          </button>
                          <button
                            type="button"
                            onClick={() => void openSavedWorkspace(workspace)}
                            disabled={openingWorkspaceId === workspace.id}
                            className={cn(buttonPrimaryClassName, "w-full")}
                          >
                            {openingWorkspaceId === workspace.id
                              ? "Opening..."
                              : "Open"}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {workspaces.length === 0 ? (
                <p className="rounded-lg border border-dashed border-app-border px-3 py-6 text-center text-sm text-stone-600 dark:text-stone-400">
                  Save a workspace first to edit its settings.
                </p>
              ) : (
                <>
                  <Field label="Workspace">
                    <select
                      value={settingsWorkspaceId ?? ""}
                      onChange={(event) =>
                        setSettingsWorkspaceId(event.target.value)
                      }
                      className={inputClassName}
                    >
                      {workspaces.map((workspace) => (
                        <option key={workspace.id} value={workspace.id}>
                          {workspace.icon ? `${workspace.icon} ` : ""}
                          {workspace.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {settingsWorkspace && (
                    <div className="space-y-4 rounded-lg border border-app-border bg-app-surface p-3">
                      <div className="grid grid-cols-[3rem_1fr] gap-2">
                        <div className="grid gap-1">
                          <span className={labelClassName}>Icon</span>
                          <EmojiIconPicker
                            icon={settingsIcon || null}
                            onSelect={setSettingsIcon}
                          />
                        </div>
                        <Field label="Title">
                          <input
                            value={settingsName}
                            onChange={(event) =>
                              setSettingsName(event.target.value)
                            }
                            className={inputClassName}
                            placeholder="My workspace"
                          />
                        </Field>
                      </div>

                      <Field label="Slug">
                        <input
                          value={settingsSlug}
                          onChange={(event) =>
                            setSettingsSlug(event.target.value)
                          }
                          className={inputClassName}
                          placeholder="my-workspace"
                        />
                      </Field>

                      <Field label="Display name">
                        <input
                          value={settingsLabel}
                          onChange={(event) =>
                            setSettingsLabel(event.target.value)
                          }
                          className={inputClassName}
                          placeholder="Shown in the sidebar"
                        />
                      </Field>

                      {isLocalWorkspace(settingsWorkspace) ? (
                        <Field label="Folder">
                          <input
                            value={settingsWorkspace.localPath ?? ""}
                            readOnly
                            className={cn(inputClassName, "opacity-80")}
                          />
                        </Field>
                      ) : (
                        <Field label="Server">
                          <input
                            value={settingsAddress}
                            onChange={(event) =>
                              setSettingsAddress(event.target.value)
                            }
                            className={inputClassName}
                            placeholder={DEFAULT_SERVER_URL}
                          />
                        </Field>
                      )}

                      {settingsError && (
                        <p className="text-sm text-red-600 dark:text-red-400">
                          {settingsError}
                        </p>
                      )}

                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                        <button
                          type="button"
                          onClick={handleSaveSettings}
                          disabled={settingsSaving || settingsReindexing}
                          className={cn(buttonPrimaryClassName, "w-full sm:w-auto")}
                        >
                          {settingsSaving ? "Saving..." : "Save changes"}
                        </button>
                        <button
                          type="button"
                          onClick={handleReindex}
                          disabled={settingsSaving || settingsReindexing}
                          className={cn(
                            buttonSecondaryClassName,
                            "w-full sm:w-auto",
                          )}
                        >
                          {settingsReindexing
                            ? "Reindexing..."
                            : "Rebuild index"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            removeWorkspace(settingsWorkspace.id);
                            setSettingsWorkspaceId(
                              workspaces.find(
                                (workspace) =>
                                  workspace.id !== settingsWorkspace.id,
                              )?.id ?? null,
                            );
                          }}
                          className="py-1.5 text-sm text-red-600 hover:underline dark:text-red-400 sm:py-0"
                        >
                          Remove bookmark
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
