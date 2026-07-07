import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { PiFolder, PiX } from "react-icons/pi";
import { useNavigate } from "react-router-dom";
import useLocalStorageState from "use-local-storage-state";
import { useSavedWorkspaces } from "../../hooks/useSavedWorkspaces";
import {
  checkServerHealth,
  createWorkspace,
  fetchWorkspaces,
  isWorkspaceNotFoundError,
  updateWorkspaceSettings,
  verifySavedWorkspaceConnection,
} from "../../lib/api";
import { cn } from "../../lib/utils";
import { workspaceNoticeMessage, type WorkspaceNotice } from "../../lib/navigation";
import { slugifyPageTitle } from "../../types/page";
import type { IndexStatus, SavedWorkspace, WorkspaceInfo } from "../../types/workspace";

export type WorkspaceManagerTab = "browse" | "settings";

type WorkspaceManagerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: WorkspaceManagerTab;
  focusSavedWorkspaceId?: string | null;
  notice?: WorkspaceNotice | null;
};

type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

type LastServer = {
  host: string;
  port: number;
};

const inputClassName = cn(
  "w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm text-stone-900 placeholder:text-stone-500 dark:text-stone-50 dark:placeholder:text-stone-500",
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
  "rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-sm text-stone-900",
  "hover:bg-stone-100 dark:text-stone-50 dark:hover:bg-stone-800",
);

function WorkspaceIcon({ icon }: { icon?: string }) {
  if (icon) return <>{icon}</>;
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
}: WorkspaceManagerDialogProps) {
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
  const navigate = useNavigate();
  const [lastServer, setLastServer] = useLocalStorageState<LastServer | null>(
    "fibbelous.lastServer",
    { defaultValue: null },
  );

  const [activeTab, setActiveTab] = useState<WorkspaceManagerTab>(initialTab);
  const [settingsWorkspaceId, setSettingsWorkspaceId] = useState<string | null>(
    null,
  );

  const [serverHost, setServerHost] = useState("127.0.0.1");
  const [serverPort, setServerPort] = useState("8080");
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
  const [settingsHost, setSettingsHost] = useState("");
  const [settingsPort, setSettingsPort] = useState("");
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [localNotice, setLocalNotice] = useState<WorkspaceNotice | null>(null);
  const [openingWorkspaceId, setOpeningWorkspaceId] = useState<string | null>(
    null,
  );

  const activeNotice = localNotice ?? notice;

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

    if (serverSource) {
      setServerHost(serverSource.serverHost);
      setServerPort(String(serverSource.serverPort));
    } else if (lastServer) {
      setServerHost(lastServer.host);
      setServerPort(String(lastServer.port));
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
    setSettingsHost(settingsWorkspace.serverHost);
    setSettingsPort(String(settingsWorkspace.serverPort));
    setSettingsError(null);
  }, [settingsWorkspace]);

  const parsedPort = Number(serverPort);

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
    if (!Number.isFinite(parsedPort) || parsedPort <= 0) return;

    setLocalNotice(null);
    setOpeningWorkspaceId(workspace.id);

    const existing = workspaces.find(
      (item) =>
        item.serverHost === serverHost &&
        item.serverPort === parsedPort &&
        item.workspaceId === workspace.id,
    );

    try {
      await verifySavedWorkspaceConnection(
        serverHost,
        parsedPort,
        workspace.id,
      );

      if (existing) {
        setActive(existing.id);
        navigate(`/${existing.slug}`);
      } else {
        const saved: SavedWorkspace = {
          id: crypto.randomUUID(),
          label: workspace.name,
          serverHost,
          serverPort: parsedPort,
          workspaceId: workspace.id,
          slug: workspace.slug,
          icon: workspace.icon,
        };
        addWorkspace(saved);
        setActive(saved.id);
        navigate(`/${saved.slug}`);
      }

      onOpenChange(false);
    } catch (error) {
      handleOpenFailure(existing?.label ?? workspace.name, error, existing);
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
      await verifySavedWorkspaceConnection(
        workspace.serverHost,
        workspace.serverPort,
        workspace.workspaceId,
      );
      setActive(workspace.id);
      navigate(`/${workspace.slug}`);
      onOpenChange(false);
    } catch (error) {
      handleOpenFailure(workspace.label, error, workspace);
    } finally {
      setOpeningWorkspaceId(null);
    }
  };

  const handleConnect = async () => {
    setConnectionError(null);

    if (!Number.isFinite(parsedPort) || parsedPort <= 0) {
      setConnectionStatus("error");
      setConnectionError("Enter a valid port number");
      return;
    }

    setConnectionStatus("connecting");

    try {
      await checkServerHealth(serverHost, parsedPort);
      const results = await fetchWorkspaces(serverHost, parsedPort);
      setRemoteWorkspaces(results);
      setConnectionStatus("connected");
      setLastServer({ host: serverHost, port: parsedPort });
    } catch (error) {
      setConnectionStatus("error");
      setConnectionError(
        error instanceof Error ? error.message : "Connection failed",
      );
      setRemoteWorkspaces([]);
    }
  };

  const handleCreate = async () => {
    setCreateError(null);

    if (!Number.isFinite(parsedPort) || parsedPort <= 0) {
      setCreateError("Connect to a server first");
      return;
    }

    const name = createName.trim();
    if (!name) {
      setCreateError("Name is required");
      return;
    }

    setCreating(true);
    try {
      const workspace = await createWorkspace(serverHost, parsedPort, {
        name,
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

  const handleSaveSettings = async () => {
    if (!settingsWorkspace) return;

    setSettingsError(null);
    setSettingsSaving(true);

    const port = Number(settingsPort);
    if (!Number.isFinite(port) || port <= 0) {
      setSettingsError("Enter a valid port number");
      setSettingsSaving(false);
      return;
    }

    const name = settingsName.trim();
    const slug = settingsSlug.trim();
    if (!name) {
      setSettingsError("Workspace name is required");
      setSettingsSaving(false);
      return;
    }
    if (!slug) {
      setSettingsError("Slug is required");
      setSettingsSaving(false);
      return;
    }

    try {
      const updated = await updateWorkspaceSettings(
        settingsHost.trim() || settingsWorkspace.serverHost,
        port,
        settingsWorkspace.workspaceId,
        {
          name,
          slug,
          icon: settingsIcon.trim(),
        },
      );

      const label = settingsLabel.trim() || updated.name;
      updateWorkspace(settingsWorkspace.id, {
        label,
        slug: updated.slug,
        icon: updated.icon,
        serverHost: settingsHost.trim() || settingsWorkspace.serverHost,
        serverPort: port,
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

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 text-stone-900 shadow-xl dark:text-stone-50",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-semibold">
                Workspaces
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-stone-600 dark:text-stone-400">
                {activeTab === "browse"
                  ? "Connect to your server, then open or create a workspace."
                  : "Edit workspace details and connection settings."}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-stone-500 hover:bg-stone-100 hover:text-stone-800 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                aria-label="Close"
              >
                <PiX className="h-4 w-4" aria-hidden />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-4 flex gap-1 rounded-lg bg-stone-100 p-1 dark:bg-stone-900">
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
              <section className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)]/40 p-3">
                <div className="grid grid-cols-[1fr_5rem_auto] gap-2">
                  <Field label="Server host">
                    <input
                      value={serverHost}
                      onChange={(event) => setServerHost(event.target.value)}
                      className={inputClassName}
                      placeholder="127.0.0.1"
                    />
                  </Field>
                  <Field label="Port">
                    <input
                      value={serverPort}
                      onChange={(event) => setServerPort(event.target.value)}
                      className={inputClassName}
                      placeholder="8080"
                      type="number"
                    />
                  </Field>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={connectionStatus === "connecting"}
                      className={cn(buttonPrimaryClassName, "w-full")}
                    >
                      {connectionStatus === "connecting" ? "..." : "Connect"}
                    </button>
                  </div>
                </div>
                {connectionStatus === "connected" && (
                  <p className="mt-2 text-xs text-green-700 dark:text-green-400">
                    Connected to {serverHost}:{serverPort}
                  </p>
                )}
                {connectionError && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {connectionError}
                  </p>
                )}
              </section>

              {connectionStatus === "connected" && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-medium text-stone-800 dark:text-stone-200">
                      On this server
                    </h2>
                    <button
                      type="button"
                      onClick={() => setShowCreateForm((value) => !value)}
                      className="text-sm text-stone-700 hover:underline dark:text-stone-300"
                    >
                      {showCreateForm ? "Cancel" : "+ New workspace"}
                    </button>
                  </div>

                  {showCreateForm && (
                    <div className="grid gap-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)]/40 p-3">
                      <div className="grid grid-cols-[3rem_1fr] gap-2">
                        <Field label="Icon">
                          <input
                            value={createIcon}
                            onChange={(event) =>
                              setCreateIcon(event.target.value)
                            }
                            className={inputClassName}
                            placeholder="Icon"
                            maxLength={4}
                          />
                        </Field>
                        <Field label="Name">
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
                    <p className="rounded-lg border border-dashed border-[var(--app-border)] px-3 py-6 text-center text-sm text-stone-600 dark:text-stone-400">
                      No workspaces on this server yet.
                    </p>
                  ) : (
                    <ul className="grid gap-2">
                      {remoteWorkspaces.map((workspace) => (
                        <li
                          key={workspace.id}
                          className="flex items-center gap-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)]/40 px-3 py-2.5"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-200/80 text-lg dark:bg-stone-800">
                            <WorkspaceIcon icon={workspace.icon} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{workspace.name}</p>
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
                              {isBookmarked(
                                serverHost,
                                parsedPort,
                                workspace.id,
                              ) && " · Saved"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void openWorkspace(workspace)}
                            disabled={openingWorkspaceId === workspace.id}
                            className={buttonPrimaryClassName}
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
                        className="flex items-center gap-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)]/40 px-3 py-2.5"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-200/80 text-lg dark:bg-stone-800">
                          <WorkspaceIcon icon={workspace.icon} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{workspace.label}</p>
                          <p className="truncate text-xs text-stone-600 dark:text-stone-400">
                            {workspace.serverHost}:{workspace.serverPort} · /
                            {workspace.slug}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSettingsWorkspaceId(workspace.id);
                              setActiveTab("settings");
                            }}
                            className={buttonSecondaryClassName}
                          >
                            Settings
                          </button>
                          <button
                            type="button"
                            onClick={() => void openSavedWorkspace(workspace)}
                            disabled={openingWorkspaceId === workspace.id}
                            className={buttonPrimaryClassName}
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
                <p className="rounded-lg border border-dashed border-[var(--app-border)] px-3 py-6 text-center text-sm text-stone-600 dark:text-stone-400">
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
                    <div className="space-y-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)]/40 p-3">
                      <div className="grid grid-cols-[3rem_1fr] gap-2">
                        <Field label="Icon">
                          <input
                            value={settingsIcon}
                            onChange={(event) =>
                              setSettingsIcon(event.target.value)
                            }
                            className={inputClassName}
                            placeholder="Icon"
                            maxLength={4}
                          />
                        </Field>
                        <Field label="Workspace name">
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

                      <div className="grid grid-cols-[1fr_5rem] gap-2">
                        <Field label="Server host">
                          <input
                            value={settingsHost}
                            onChange={(event) =>
                              setSettingsHost(event.target.value)
                            }
                            className={inputClassName}
                            placeholder="127.0.0.1"
                          />
                        </Field>
                        <Field label="Port">
                          <input
                            value={settingsPort}
                            onChange={(event) =>
                              setSettingsPort(event.target.value)
                            }
                            className={inputClassName}
                            placeholder="8080"
                            type="number"
                          />
                        </Field>
                      </div>

                      {settingsError && (
                        <p className="text-sm text-red-600 dark:text-red-400">
                          {settingsError}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSaveSettings}
                          disabled={settingsSaving}
                          className={buttonPrimaryClassName}
                        >
                          {settingsSaving ? "Saving..." : "Save changes"}
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
                          className="text-sm text-red-600 hover:underline dark:text-red-400"
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
