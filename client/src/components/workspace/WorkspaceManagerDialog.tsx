import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSavedWorkspaces } from "../../hooks/useSavedWorkspaces";
import { fetchWorkspaces } from "../../lib/api";
import { cn } from "../../lib/utils";
import type { SavedWorkspace, WorkspaceInfo } from "../../types/workspace";

type WorkspaceManagerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const inputClassName = cn(
  "rounded border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900",
  "placeholder:text-zinc-400",
  "dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500",
);

export function WorkspaceManagerDialog({
  open,
  onOpenChange,
}: WorkspaceManagerDialogProps) {
  const {
    workspaces,
    addWorkspace,
    updateWorkspace,
    removeWorkspace,
    setActive,
  } = useSavedWorkspaces();
  const navigate = useNavigate();

  const [serverHost, setServerHost] = useState("127.0.0.1");
  const [serverPort, setServerPort] = useState("8080");
  const [remoteWorkspaces, setRemoteWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFetch = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const port = Number(serverPort);
      if (!Number.isFinite(port) || port <= 0) {
        throw new Error("Enter a valid port number");
      }
      const results = await fetchWorkspaces(serverHost, port);
      setRemoteWorkspaces(results);
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : "Fetch failed");
      setRemoteWorkspaces([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRemote = (workspace: WorkspaceInfo) => {
    const port = Number(serverPort);
    const saved: SavedWorkspace = {
      id: crypto.randomUUID(),
      label: workspace.name,
      serverHost,
      serverPort: port,
      workspaceId: workspace.id,
      slug: workspace.slug,
      icon: workspace.icon,
    };
    addWorkspace(saved);
    setActive(saved.id);
    navigate(`/${saved.slug}`);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-4 text-zinc-900 shadow-xl",
            "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100",
          )}
        >
          <Dialog.Title className="text-base font-semibold">
            Workspace manager
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Edit saved workspaces or add one from a server.
          </Dialog.Description>

          <section className="mt-4 space-y-2">
            <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Saved workspaces
            </h2>
            {workspaces.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No workspaces saved yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {workspaces.map((workspace) => (
                  <li
                    key={workspace.id}
                    className="rounded-md border border-zinc-200 p-2 dark:border-zinc-700 dark:bg-zinc-950/50"
                  >
                    <div className="grid gap-2">
                      <input
                        value={workspace.label}
                        onChange={(event) =>
                          updateWorkspace(workspace.id, {
                            label: event.target.value,
                          })
                        }
                        className={inputClassName}
                        placeholder="Label"
                      />
                      <div className="grid grid-cols-[1fr_5rem] gap-2">
                        <input
                          value={workspace.serverHost}
                          onChange={(event) =>
                            updateWorkspace(workspace.id, {
                              serverHost: event.target.value,
                            })
                          }
                          className={inputClassName}
                          placeholder="Host"
                        />
                        <input
                          value={workspace.serverPort}
                          onChange={(event) =>
                            updateWorkspace(workspace.id, {
                              serverPort: Number(event.target.value) || 0,
                            })
                          }
                          className={inputClassName}
                          placeholder="Port"
                          type="number"
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                        <span>
                          {workspace.icon ? `${workspace.icon} ` : ""}
                          /{workspace.slug} · {workspace.workspaceId}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeWorkspace(workspace.id)}
                          className="text-red-600 hover:underline dark:text-red-400"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-6 space-y-2">
            <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Add from server
            </h2>
            <div className="grid grid-cols-[1fr_5rem_auto] gap-2">
              <input
                value={serverHost}
                onChange={(event) => setServerHost(event.target.value)}
                className={inputClassName}
                placeholder="Host"
              />
              <input
                value={serverPort}
                onChange={(event) => setServerPort(event.target.value)}
                className={inputClassName}
                placeholder="Port"
                type="number"
              />
              <button
                type="button"
                onClick={handleFetch}
                disabled={loading}
                className={cn(
                  "rounded bg-zinc-900 px-3 py-1 text-sm text-white",
                  "hover:bg-zinc-800 disabled:opacity-50",
                  "dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200",
                )}
              >
                {loading ? "..." : "Fetch"}
              </button>
            </div>
            {fetchError && (
              <p className="text-sm text-red-600 dark:text-red-400">{fetchError}</p>
            )}
            {remoteWorkspaces.length > 0 && (
              <ul className="space-y-1">
                {remoteWorkspaces.map((workspace) => (
                  <li
                    key={workspace.id}
                    className={cn(
                      "flex items-center justify-between rounded-md border border-zinc-200 px-2 py-1.5 text-sm",
                      "dark:border-zinc-700 dark:bg-zinc-950/50",
                    )}
                  >
                    <span>
                      {workspace.icon ? `${workspace.icon} ` : ""}
                      {workspace.name}{" "}
                      <span className="text-zinc-500 dark:text-zinc-400">
                        /{workspace.slug} · {workspace.indexStatus}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAddRemote(workspace)}
                      className="text-zinc-700 hover:underline dark:text-zinc-300"
                    >
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="mt-4 flex justify-end">
            <Dialog.Close asChild>
              <button
                type="button"
                className={cn(
                  "rounded border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900",
                  "hover:bg-zinc-50",
                  "dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
                )}
              >
                Close
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
