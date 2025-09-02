import { useNavigate } from "react-router";
import { useState } from "react";
import {
  AlertCircle,
  ChevronRight,
  FolderOpen,
  FolderSymlink,
  Loader2,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { useWorkspaceManager } from "@/contexts/WorkspaceManagerContext";
import { EyeIcon } from "lucide-react";
import { WorkspaceConnection, WorkspaceInfo } from "@/models";
import { IS_APP } from "@/checks";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { CollapsibleTrigger } from "@radix-ui/react-collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { useAppNavigation } from "@/contexts/AppNavigationContext";

export default function SettingsWorkspacePage() {
  const {
    list: workspaces,
    pickLocal,
    deleteWorkspace,
    fetchRemoteWorkspaces,
    saveRemoteWorkspaces,
    openInSystem,
    loaded,
  } = useWorkspaceManager();
  const navigate = useNavigate();
  const appNavigation = useAppNavigation();

  const [error, setError] = useState<string | null>(null);
  const [remoteUrl, setRemoteUrl] = useState<string>("");
  const [connecting, setConnecting] = useState<boolean>(false);
  const [fetchedWorkspaces, setFetchedWorkspaces] = useState<
    WorkspaceInfo[] | undefined
  >();
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<string[]>([]);

  function handleRemove(workspace: WorkspaceInfo) {
    deleteWorkspace(workspace.id);
  }

  function handleVisit(workspace: WorkspaceInfo) {
    navigate(`/${workspace.slug}`);
  }

  async function startOpenLocal() {
    setError(null);
    const res = await pickLocal(true);
    if (res.error) {
      setError(res.error);
      return;
    }
  }

  async function startCreateLocal() {
    setError(null);
    const res = await pickLocal(false);
    if (res.error) {
      setError(res.error);
      return;
    }
  }

  async function connectToRemote() {
    setConnecting(true);

    const minTimeout = new Promise((resolve) => setTimeout(resolve, 500));
    const fetchPromise = fetchRemoteWorkspaces(remoteUrl).catch((err) => {
      setError(err.message || "Failed to fetch workspaces");
      return [];
    });

    await Promise.all([minTimeout, fetchPromise]);
    setFetchedWorkspaces(await fetchPromise);
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

    const savedWorkspaces = selected.map(
      (w): WorkspaceConnection => ({
        info: w,
        url: remoteUrl,
      })
    );

    await saveRemoteWorkspaces(...savedWorkspaces)
      .then(() => {
        appNavigation.openHome();
      })
      .catch((err) => {
        setError(err.message || "Failed to add remote workspaces");
      });
  }

  return (
    <div className="SettingsWorkspacePage p-2 select-none">
      <h2 className="text-lg font-bold mb-4">Workspaces</h2>
      {loaded && (
        <>
          <ul className="mb-4">
            {workspaces.map((w) => (
              <li
                key={w.id}
                className="flex items-center mb-2 h-14 bg-gray-700 rounded-sm p-2"
              >
                <div className="hover:bg-gray-500 rounded-sm hover:border border-gray-400 cursor-pointer aspect-square select-none h-8 flex items-center justify-center mr-2">
                  {w.icon}
                </div>
                <span className="text-lg">{w.title}</span>
                <div className="ml-auto">
                  <button
                    className="px-2 py-1 text-gray-500 hover:text-white hover:bg-green-500 cursor-pointer rounded"
                    onClick={() => handleVisit(w)}
                    title="Load workspace"
                  >
                    <EyeIcon className="w-4" />
                  </button>
                  <button
                    className="px-2 py-1 text-gray-500 hover:text-white hover:bg-yellow-500 cursor-pointer rounded"
                    onClick={() => openInSystem(w.id)}
                    title="Open in System"
                  >
                    <FolderSymlink className="w-4" />
                  </button>
                  <button
                    className="px-2 py-1 text-gray-500 hover:text-white hover:bg-red-500 cursor-pointer rounded"
                    onClick={() => handleRemove(w)}
                    title="Remove workspace"
                  >
                    <XIcon className="w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <Collapsible defaultOpen={workspaces.length == 0}>
            <CollapsibleTrigger className="flex items-center text-lg h-14 text-gray-300 bg-gray-700/50 px-3 rounded-sm group data-[state=open]:rounded-b-none p-2 w-full cursor-pointer">
              <PlusIcon className="w-5 h-5 ml-1 mr-3" />
              Add Workspace
              <ChevronRight className="ml-auto group-data-[state=open]:rotate-90 w-5 h-5 text-gray-500 transition-transform" />
            </CollapsibleTrigger>
            <CollapsibleContent className="bg-gray-700/50 p-4 pt-2 rounded-b-sm">
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
                  <p className="text-sm mb-2 text-gray-300">
                    Choose workspace(s) to import
                  </p>
                  <ul>
                    {fetchedWorkspaces.map((workspace) => (
                      <li key={workspace.id} className="mb-2">
                        <label className="hover:bg-gray-700 cursor-pointer flex items-start gap-3 rounded-lg border p-3 has-[[aria-checked=true]]:border-gray-600 has-[[aria-checked=true]]:bg-gray-500 dark:has-[[aria-checked=true]]:border-gray-900 dark:has-[[aria-checked=true]]:bg-gray-950">
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
                    Import ({selectedWorkspaces.length}) workspaces
                  </button>
                </>
              )}
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </div>
  );
}
