import { useState } from "react";
import { useNavigate } from "react-router";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { EyeIcon, TrashIcon } from "lucide-react";

export default function SettingsWorkspacePage() {
  const { workspaces, addWorkspace, deleteWorkspace } = useWorkspaceContext();
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("");
  const navigate = useNavigate();

  function handleDelete(id: string) {
    deleteWorkspace(id);
  }

  function handleAdd() {
    if (!newName.trim()) return;
    const id = newName.trim().toLowerCase().replace(/\s+/g, "-");
    if (workspaces.some((w) => w.id === id)) return;
    addWorkspace({ id, name: newName.trim(), icon: newIcon || "📁" });
    setNewName("");
    setNewIcon("");
  }

  function handleVisit(id: string) {
    navigate(`/${id}`);
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
            <span className="text-lg">{w.name}</span>
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
      <div className="flex gap-2">
        <input
          className="border px-2 py-1 rounded w-12 text-center"
          type="text"
          placeholder="Icon"
          value={newIcon}
          maxLength={2}
          onChange={(e) => setNewIcon(e.target.value)}
        />
        <input
          className="border px-2 py-1 rounded flex-1"
          type="text"
          placeholder="New workspace name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          className="px-3 py-1 bg-blue-600 text-white rounded"
          onClick={handleAdd}
          disabled={
            !newName.trim() ||
            workspaces.some(
              (w) => w.id === newName.trim().toLowerCase().replace(/\s+/g, "-")
            )
          }
        >
          Add
        </button>
      </div>
    </div>
  );
}
