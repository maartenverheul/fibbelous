import { useState } from "react";
import useLocalStorageState from "use-local-storage-state";
import { AlertCircle, FolderOpen, Loader2, PlusIcon } from "lucide-react";
import { useWorkspaceManager } from "@/contexts/WorkspaceManagerContext";
import {
  ConnectionType,
  CreateWorkspaceRequest,
  Workspace,
  WorkspaceInfo,
} from "@/models";
import { IS_APP } from "@/checks";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import EditWorkspaceForm from "./EditWorkspaceForm";
import { useAppNavigation } from "@/contexts/AppNavigationContext";

export function AddWorkspaceForm() {
  const appNavigation = useAppNavigation();
  const workspaceManager = useWorkspaceManager();

  const [error, setError] = useState<string | null>(null);
  const [lastRemoteUrl, setLastRemoteUrl] = useLocalStorageState<string>(
    "lastRemoteUrl",
    { defaultValue: "" }
  );
  const [remoteUrl, setRemoteUrl] = useState<string>(lastRemoteUrl || "");
  const [connecting, setConnecting] = useState<boolean>(false);
  const [fetchedWorkspaces, setFetchedWorkspaces] = useState<
    WorkspaceInfo[] | undefined
  >();
  const [fetchedTotalCount, setFetchedTotalCount] = useState<
    number | undefined
  >(undefined);
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<"existing" | "new">("existing");

  async function startOpenLocal() {
    setError(null);
    const res = await workspaceManager.pickLocal(true);
    if (res.error) {
      setError(res.error);
      return;
    }
  }

  async function startCreateLocal() {
    setError(null);
    const res = await workspaceManager.pickLocal(false);
    if (res.error) {
      setError(res.error);
      return;
    }
  }

  async function connectToRemote() {
    setConnecting(true);
    setError(null);

    const minTimeout = new Promise((resolve) => setTimeout(resolve, 500));
    const fetchPromise = workspaceManager
      .fetchRemoteWorkspaces(remoteUrl)
      .catch((err) => {
        setError(err.message || "Failed to fetch workspaces");
        return [] as WorkspaceInfo[];
      });

    await Promise.all([minTimeout, fetchPromise]);
    const result = await fetchPromise;
    setFetchedTotalCount(result.length);
    const existingIds = new Set(
      workspaceManager.workspaces.map((w) => w.info.id)
    );
    const filtered = result.filter((r) => !existingIds.has(r.id));
    setFetchedWorkspaces(filtered);
    setConnecting(false);
  }

  async function importSelectedWorkspaces() {
    setError(null);
    const selected = fetchedWorkspaces?.filter((w) =>
      selectedWorkspaces.includes(w.id)
    );
    if (!selected || selected.length === 0) {
      setError("No workspaces selected");
      return;
    }

    for (const ws of selected) {
      const workspace: Workspace = {
        info: ws,
        connection: {
          url: remoteUrl,
          type: ConnectionType.remote,
          cachedInfo: ws,
        },
        connectionState: {
          success: true,
        },
      };
      workspaceManager.addWorkspace(workspace);
    }
    if (remoteUrl) setLastRemoteUrl(remoteUrl);

    if (selected.length === 1) {
      setTimeout(() => {
        appNavigation.navigate(appNavigation.workspaceHomeLink(selected[0]));
      }, 0);
    }
  }

  async function handleCreateNewWorkspace(
    request: CreateWorkspaceRequest,
    url?: string
  ): Promise<void> {
    // Reset creation form state basics
    await new Promise((resolve) => setTimeout(resolve, 500)); // wait a bit to ensure FS is ready
    var workspace = await workspaceManager.createWorkspace(request, url);
    setImportMode("existing");
    setSelectedWorkspaces([]);
    if (remoteUrl) setLastRemoteUrl(remoteUrl);
    appNavigation.navigate(appNavigation.workspaceHomeLink(workspace));
  }

  return (
    <>
      {error && (
        <div
          role="alert"
          className="inline-flex w-full items-start gap-2 rounded border border-red-800 bg-red-700 px-3 py-2 text-white text-sm shadow-sm"
        >
          <AlertCircle className="h-4 w-4 mt-0.5 text-white" />
          <span>{error}</span>
        </div>
      )}
      {IS_APP && (
        <>
          <p className="text-sm mb-1 text-gray-300">Local</p>
          <div className="flex flex-row gap-2 mt-2 mb-4">
            <button
              className="px-3 py-1 bg-blue-600 text-white rounded cursor-pointer w-full flex items-center justify-center gap-2"
              onClick={startOpenLocal}
            >
              <FolderOpen className="w-4" />
              Open local repository
            </button>
            <button
              className="px-3 py-1 bg-blue-600 text-white rounded cursor-pointer w-full flex items-center justify-center gap-2"
              onClick={startCreateLocal}
            >
              <PlusIcon className="w-5" />
              New local repository
            </button>
          </div>
        </>
      )}
      <p className="text-sm mb-1 text-gray-300">Remote</p>
      <div className=" flex gap-2 items-center mb-2">
        <input
          type="text"
          placeholder="https://server.example:8080"
          className="px-2 py-1 rounded bg-gray-800 text-white border border-gray-600 flex-1 placeholder:text-gray-500"
          value={remoteUrl}
          onChange={(e) => setRemoteUrl(e.target.value)}
        />
        <button
          className="px-3 py-1 bg-blue-600 text-white rounded cursor-pointer w-24 disabled:bg-gray-600 disabled:cursor-default"
          disabled={!remoteUrl}
          onClick={connectToRemote}
        >
          {connecting ? (
            <Loader2 className="mx-auto animate-spin" />
          ) : (
            "Connect"
          )}
        </button>
      </div>
      {fetchedWorkspaces && (
        <>
          <RadioGroup
            className="flex mb-4"
            defaultValue="existing"
            value={importMode}
            onValueChange={(v) => setImportMode(v as any)}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                className="text-white [&_*]:fill-white"
                value="existing"
                id="mode-existing"
              />
              <label className="cursor-pointer" htmlFor="mode-existing">
                Import existing
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                className="text-white [&_*]:fill-white"
                value="new"
                id="mode-new"
              />
              <label className="cursor-pointer" htmlFor="mode-new">
                Create new
              </label>
            </div>
          </RadioGroup>
          {importMode === "existing" &&
            (fetchedWorkspaces.length === 0 ? (
              <p className="text-sm mb-2 text-gray-400 italic">
                {fetchedTotalCount === 0
                  ? "Server has no workspaces."
                  : "All remote workspaces are already imported."}
              </p>
            ) : (
              <>
                <p className="text-sm mb-2 text-gray-300">
                  Choose workspace(s) to import
                </p>
                <ul className="flex gap-2 flex-wrap max-h-[250px] content-start overflow-y-auto">
                  {fetchedWorkspaces.map((workspace) => (
                    <li key={workspace.id}>
                      <label className="hover:bg-gray-700 w-max cursor-pointer flex items-center gap-3 rounded-lg border h-11 p-3 has-[[aria-checked=true]]:border-gray-600 has-[[aria-checked=true]]:bg-gray-500 dark:has-[[aria-checked=true]]:border-gray-900 dark:has-[[aria-checked=true]]:bg-gray-950">
                        <Checkbox
                          id={`import-workspace-${workspace.id}`}
                          checked={selectedWorkspaces.includes(workspace.id)}
                          className="cursor-pointer data-[state=checked]:bg-gray-800"
                          onCheckedChange={(checked) => {
                            setSelectedWorkspaces((prev) =>
                              checked
                                ? [...prev, workspace.id]
                                : prev.filter((id) => id !== workspace.id)
                            );
                          }}
                        />
                        <p className="text-sm leading-none font-medium">
                          <span className="mr-2">{workspace.icon}</span>
                          <span>{workspace.title}</span>
                        </p>
                      </label>
                    </li>
                  ))}
                </ul>
                <button
                  className="mt-4 px-4 py-1 bg-blue-600 text-white rounded cursor-pointer disabled:bg-gray-600 disabled:cursor-default"
                  onClick={importSelectedWorkspaces}
                  disabled={selectedWorkspaces.length === 0}
                >
                  {importMode === "existing" ? "Import" : "Create"} (
                  {selectedWorkspaces.length}) workspaces
                </button>
              </>
            ))}
          {importMode === "new" && (
            <div className="mt-2 p-3 rounded border border-gray-700 bg-gray-800/40">
              <p className="text-sm text-gray-300 mb-3">
                Create a new workspace
              </p>
              <EditWorkspaceForm
                remoteUrl={remoteUrl || undefined}
                onSave={handleCreateNewWorkspace}
              />
            </div>
          )}
        </>
      )}
    </>
  );
}

export default AddWorkspaceForm;
