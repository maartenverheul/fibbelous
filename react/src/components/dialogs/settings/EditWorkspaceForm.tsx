import { useEffect, useState } from "react";
import { WorkspaceInfo } from "@/models";
import { useWorkspaceManager } from "@/contexts/WorkspaceManagerContext";
import { Check, RotateCcw } from "lucide-react";

export default function EditWorkspaceForm({ workspace }: { workspace: WorkspaceInfo }) {
  const { updateWorkspace, list } = useWorkspaceManager();

  const [title, setTitle] = useState(workspace.title);
  const [slug, setSlug] = useState(workspace.slug);
  const [description, setDescription] = useState(workspace.description ?? "");
  const [icon, setIcon] = useState(workspace.icon ?? "");
  const [connectionUrl, setConnectionUrl] = useState(workspace.connection?.url ?? "");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [saved, setSaved] = useState(false);

  // Auto-generate slug from title until user edits slug manually
  useEffect(() => {
    if (!slugManuallyEdited) {
      const auto = slugify(title);
      setSlug(auto);
    }
  }, [title, slugManuallyEdited]);

  // Clear saved flag after a delay
  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => setSaved(false), 1500);
      return () => clearTimeout(t);
    }
  }, [saved]);

  const slugConflict = list.some(w => w.id !== workspace.id && w.slug === slug);
  const disabled = !title.trim() || !slug.trim() || slugConflict;

  function handleSave() {
    if (disabled) return;
    const updated: WorkspaceInfo = {
      ...workspace,
      title: title.trim(),
      slug: slug.trim(),
      description: description.trim() || undefined,
      icon: icon.trim() || undefined,
      connection: connectionUrl ? { url: connectionUrl } : workspace.connection,
    };
    updateWorkspace(updated);
    setSaved(true);
  }

  function handleReset() {
    setTitle(workspace.title);
    setSlug(workspace.slug);
    setDescription(workspace.description ?? "");
    setIcon(workspace.icon ?? "");
    setConnectionUrl(workspace.connection?.url ?? "");
    setSlugManuallyEdited(false);
    setSaved(false);
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
          <label className="mb-1 text-gray-300" htmlFor={`ws-title-${workspace.id}`}>Title</label>
          <input
            id={`ws-title-${workspace.id}`}
            className="px-2 py-1 rounded bg-gray-800 text-white border border-gray-600"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Workspace title"
          />
        </div>
        <div className="flex flex-col w-28">
          <label className="mb-1 text-gray-300" htmlFor={`ws-icon-${workspace.id}`}>Icon</label>
          <input
            id={`ws-icon-${workspace.id}`}
            className="px-2 py-1 rounded bg-gray-800 text-white border border-gray-600"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="😀"
            maxLength={2}
          />
        </div>
      </div>

      <div className="flex flex-col">
        <label className="mb-1 text-gray-300" htmlFor={`ws-slug-${workspace.id}`}>Slug</label>
        <input
          id={`ws-slug-${workspace.id}`}
          className={`px-2 py-1 rounded bg-gray-800 text-white border ${slugConflict ? 'border-red-600' : 'border-gray-600'}`}
          value={slug}
          onChange={(e) => { setSlug(e.target.value); setSlugManuallyEdited(true); }}
          placeholder="workspace-slug"
        />
        {slugConflict && (
          <span className="text-xs text-red-400 mt-1">Slug already in use.</span>
        )}
      </div>

      <div className="flex flex-col">
        <label className="mb-1 text-gray-300" htmlFor={`ws-desc-${workspace.id}`}>Description</label>
        <textarea
          id={`ws-desc-${workspace.id}`}
          className="px-2 py-1 rounded bg-gray-800 text-white border border-gray-600 resize-none h-20"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description"
        />
      </div>

      {workspace.connection?.url !== undefined && (
        <div className="flex flex-col">
          <label className="mb-1 text-gray-300" htmlFor={`ws-url-${workspace.id}`}>Remote URL</label>
          <div
            id={`ws-url-${workspace.id}`}
            className="px-2 py-1 rounded bg-gray-800 text-white/50 border border-gray-600"
          >
            {connectionUrl}
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-2">
        <button
          type="submit"
          className="px-3 py-1 bg-blue-600 text-white rounded disabled:bg-gray-600 flex items-center gap-2 cursor-pointer"
          disabled={disabled}
        >
          <Check className="w-4" /> {saved ? 'Saved' : 'Save'}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="px-3 py-1 bg-gray-600 text-white rounded flex items-center gap-2 cursor-pointer"
        >
          <RotateCcw className="w-4" /> Reset
        </button>
      </div>
    </form>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
