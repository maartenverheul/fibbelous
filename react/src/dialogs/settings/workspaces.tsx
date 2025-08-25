import { useNavigate } from "react-router";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { EyeIcon, TrashIcon } from "lucide-react";

export default function SettingsWorkspacePage() {
  const { workspaces, pickLocal, deleteWorkspace } = useWorkspaceContext();
  const navigate = useNavigate();

  function handleDelete(id: string) {
    deleteWorkspace(id);
  }

  function handleVisit(id: string) {
    navigate(`/${id}`);
  }

  async function startPickLocal() {
    const workspace = await pickLocal();
    if (workspace) navigate(`/${workspace.id}`);
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
      <div className="flex gap-2">
        <button
          className="px-3 py-1 bg-blue-600 text-white rounded cursor-pointer"
          onClick={startPickLocal}
        >
          Open local repository
        </button>
      </div>
    </div>
  );
}
