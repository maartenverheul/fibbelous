import { useNavigate } from "react-router";
import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { EyeIcon, TrashIcon } from "lucide-react";

export default function SettingsWorkspacePage() {
  const { workspaces, pickLocal, deleteWorkspace } = useWorkspaceContext();
  const navigate = useNavigate();
  const [openError, setOpenError] = useState<string | null>(null);

  function handleDelete(id: string) {
    deleteWorkspace(id);
  }

  function handleVisit(id: string) {
    navigate(`/${id}`);
  }

  async function startPickLocal() {
    setOpenError(null);
    const res = await pickLocal();
    if (!res.ok) {
      setOpenError(res.error ?? "Failed to open workspace");
      return;
    }
  }

  return (
    <div className="p-2">
      <h2 className="text-lg font-bold mb-4">Workspaces</h2>
      <ul className="mb-4">
        {workspaces.map((w) => (
          <li
            key={w.id}
            className="flex items-center mb-2 border rounded-sm p-2"
          >
            <div className="hover:bg-slate-500 rounded-sm hover:border border-slate-400 cursor-pointer aspect-square select-none h-8 flex items-center justify-center mr-2">
              {w.icon}
            </div>
            <span className="text-lg">{w.title}</span>
            <button
              className="px-2 py-1 text-slate-600 hover:text-white hover:bg-green-500 cursor-pointer rounded ml-auto"
              onClick={() => handleVisit(w.id)}
            >
              <EyeIcon className="w-4" />
            </button>
            <button
              className="px-2 py-1 text-slate-600 hover:text-white hover:bg-red-500 cursor-pointer rounded"
              onClick={() => handleDelete(w.id)}
            >
              <TrashIcon className="w-4" />
            </button>
          </li>
        ))}
      </ul>
      <hr className="my-4" />
      <div className="flex flex-col gap-2">
        <button
          className="px-3 py-1 bg-blue-600 text-white rounded cursor-pointer"
          onClick={startPickLocal}
        >
          Open local repository
        </button>
        {openError && (
          <div
            role="alert"
            className="inline-flex items-start gap-2 rounded border border-red-800 bg-red-700 px-3 py-2 text-white text-sm shadow-sm"
          >
            <AlertCircle className="h-4 w-4 mt-0.5 text-white" />
            <span>{openError}</span>
          </div>
        )}
      </div>
    </div>
  );
}
