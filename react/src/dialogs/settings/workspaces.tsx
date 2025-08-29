import { useNavigate } from "react-router";
import { useState } from "react";
import {
  AlertCircle,
  ChevronRight,
  FolderOpen,
  FolderSymlink,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { EyeIcon } from "lucide-react";
import { WorkspaceInfo } from "@/models";
import { IS_APP } from "@/checks";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { CollapsibleTrigger } from "@radix-ui/react-collapsible";

export default function SettingsWorkspacePage() {
  const { workspaces, pickLocal, deleteWorkspace, openInSystem, loaded } =
    useWorkspaceContext();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="SettingsWorkspacePage p-2 select-none">
      <h2 className="text-lg font-bold mb-4">Workspaces</h2>
      {
        loaded && <>
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
            <CollapsibleContent className="bg-gray-700/50 p-2 rounded-b-sm">
              {error && (
                <div
                  role="alert"
                  className="inline-flex w-full items-start gap-2 rounded border border-red-800 bg-red-700 px-3 py-2 text-white text-sm shadow-sm"
                >
                  <AlertCircle className="h-4 w-4 mt-0.5 text-white" />
                  <span>{error}</span>
                </div>
              )}
              {
                IS_APP && <>
                  <p className="text-sm mb-1 text-gray-300">Local</p>
                  <div className="flex flex-row gap-2 mt-2">
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
              }
              <p className="mt-4 text-sm mb-1 text-gray-300">Remote</p>
              <div className=" flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="https://server.example:8080"
                  className="px-2 py-1 rounded bg-gray-800 text-white border border-gray-600 flex-1 placeholder:text-gray-500"
                />
                <button
                  className="px-3 py-1 bg-blue-600 text-white rounded cursor-pointer"
                >
                  Connect
                </button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </>
      }
    </div>
  );
}
