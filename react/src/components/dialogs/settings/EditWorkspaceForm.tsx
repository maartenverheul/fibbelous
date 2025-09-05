import { useState } from "react";
import { Workspace, WorkspaceInfo } from "@/models";
import { useWorkspaceManager } from "@/contexts/WorkspaceManagerContext";
import { RotateCcw, SaveIcon } from "lucide-react";
import { toast } from "sonner";

type Props = {
  workspace: Workspace;
  readOnly?: boolean; // if true, form is read-only (for offline workspaces)
};

export default function EditWorkspaceForm({ workspace, readOnly = false }: Props) {
  const { updateWorkspace, workspaces } = useWorkspaceManager();

  const [title, setTitle] = useState(workspace.info.title);
  const [slug, setSlug] = useState(workspace.info.slug);
  const [description, setDescription] = useState(workspace.info.description ?? "");
  const [icon, setIcon] = useState(workspace.info.icon ?? "");
  const [connectionUrl, setConnectionUrl] = useState(workspace.connection?.url ?? "");

  const slugConflict = workspaces.some(w => w.info.id !== workspace.info.id && w.info.slug === slug);
  const disabled = readOnly || !title.trim() || !slug.trim() || slugConflict;

  function handleSave() {
    if (disabled || readOnly) return;
    const updated: WorkspaceInfo = {
      ...workspace.info,
      title: title.trim(),
      slug: slug.trim(),
      description: description.trim(),
      icon: icon.trim(),
    };
    updateWorkspace(updated);
    toast("Workspace has been updated.");
  }

  function handleReset() {
    setTitle(workspace.info.title);
    setSlug(workspace.info.slug);
    setDescription(workspace.info.description ?? "");
    setIcon(workspace.info.icon ?? "");
    setConnectionUrl(workspace.connection?.url ?? "");
  }

  return (
    <form
      className="flex flex-col gap-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      <div className="flex gap-2">
        <div className="flex flex-col flex-1">
          <label className="mb-1 text-gray-300" htmlFor={`ws-title-${workspace.info.id}`}>Title</label>
          <input
            id={`ws-title-${workspace.info.id}`}
            className="px-2 py-1 rounded bg-gray-800 text-white border border-gray-600 disabled:text-white/50  disabled:cursor-not-allowed"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={readOnly}
            placeholder="Workspace title"
          />
        </div>
        <div className="flex flex-col w-28">
          <label className="mb-1 text-gray-300" htmlFor={`ws-icon-${workspace.info.id}`}>Icon</label>
          <input
            id={`ws-icon-${workspace.info.id}`}
            className="px-2 py-1 rounded bg-gray-800 text-white border border-gray-600 disabled:text-white/50  disabled:cursor-not-allowed"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            disabled={readOnly}
            placeholder="😀"
            maxLength={2}
          />
        </div>
      </div>

      <div className="flex flex-col">
        <label className="mb-1 text-gray-300" htmlFor={`ws-slug-${workspace.info.id}`}>Slug</label>
        <input
          id={`ws-slug-${workspace.info.id}`}
          className={`px-2 py-1 rounded bg-gray-800 text-white border ${slugConflict ? 'border-red-600' : 'border-gray-600'} disabled:text-white/50  disabled:cursor-not-allowed`}
          value={slug}
          onChange={(e) => { setSlug(e.target.value); }}
          disabled={readOnly}
          placeholder="workspace-slug"
        />
        {slugConflict && (
          <span className="text-xs text-red-400 mt-1">Slug already in use.</span>
        )}
      </div>

      <div className="flex flex-col">
        <label className="mb-1 text-gray-300" htmlFor={`ws-desc-${workspace.info.id}`}>Description</label>
        <textarea
          id={`ws-desc-${workspace.info.id}`}
          className="px-2 py-1 rounded bg-gray-800 text-white border border-gray-600 resize-none h-20 disabled:text-white/50  disabled:cursor-not-allowed"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={readOnly}
          placeholder="Short description"
        />
      </div>

      {workspace.connection?.url !== undefined && (
        <div className="flex flex-col">
          <label className="mb-1 text-gray-300" htmlFor={`ws-url-${workspace.info.id}`}>Remote URL</label>
          <div
            id={`ws-url-${workspace.info.id}`}
            className="px-2 py-1 rounded bg-gray-800 text-white/50 border border-gray-600"
          >
            {connectionUrl}
          </div>
        </div>
      )}

      {!readOnly && (
        <div className="flex gap-2 mt-2">
          <button
            type="submit"
            className="px-3 py-1 bg-blue-600 text-white rounded disabled:bg-gray-600 flex items-center gap-2 cursor-pointer"
            disabled={disabled}
          >
            <SaveIcon className="w-4" /> Save
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1 bg-gray-600 text-white rounded flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4" /> Reset
          </button>
        </div>
      )}
    </form>
  );
}
