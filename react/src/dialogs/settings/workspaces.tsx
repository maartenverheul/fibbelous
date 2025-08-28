import { useNavigate } from "react-router";
import { useState } from "react";
import {
  AlertCircle,
  FolderOpen,
  FolderSymlink,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { EyeIcon } from "lucide-react";
import { WorkspaceInfo } from "@/models";

export default function SettingsWorkspacePage() {
  const { workspaces, pickLocal, deleteWorkspace, openInSystem } =
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
      <ul className="mb-4">
        {workspaces.map((w) => (
          <li
            key={w.id}
            className="flex items-center mb-2 bg-gray-700 rounded-sm p-2"
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

      {error && (
        <div
          role="alert"
          className="inline-flex w-full items-start gap-2 rounded border border-red-800 bg-red-700 px-3 py-2 text-white text-sm shadow-sm"
        >
          <AlertCircle className="h-4 w-4 mt-0.5 text-white" />
          <span>{error}</span>
        </div>
      )}
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
    </div>
  );
}
