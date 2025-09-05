import { useState } from "react";
import { Workspace, WorkspaceInfo, ConnectionType } from "@/models";
import { useWorkspaceManager } from "@/contexts/WorkspaceManagerContext";
import { RotateCcw, SaveIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

type EditProps = {
  workspace: Workspace;
  readOnly?: boolean;
  create?: false;
  onCreate?: never;
  remoteUrl?: string;
};
type CreateProps = {
  workspace?: undefined;
  readOnly?: false; // creation is always editable
  create: true;
  onCreate: (workspace: Workspace) => void;
  remoteUrl?: string; // if provided, set as connection url
};
type Props = EditProps | CreateProps;

export default function EditWorkspaceForm(props: Props) {
  const { updateWorkspace, workspaces, addWorkspace } = useWorkspaceManager();

  const isCreate = props.create === true;
  const workspace = props.workspace;
  const readOnly = !isCreate && (props.readOnly ?? false);
  const remoteUrl = props.remoteUrl;

  const [title, setTitle] = useState(isCreate ? "" : workspace!.info.title);
  const [slug, setSlug] = useState(isCreate ? "" : workspace!.info.slug);
  const [description, setDescription] = useState(isCreate ? "" : (workspace!.info.description ?? ""));
  const [icon, setIcon] = useState(isCreate ? "" : (workspace!.info.icon ?? ""));
  const [connectionUrl, setConnectionUrl] = useState(isCreate ? (remoteUrl ?? "") : (workspace!.connection?.url ?? ""));

  const slugConflict = !!slug && workspaces.some(w => (!isCreate ? w.info.id !== workspace!.info.id : true) && w.info.slug === slug);
  const disabled = readOnly || !title.trim() || !slug.trim() || slugConflict;

  function buildWorkspaceInfo(): WorkspaceInfo {
    if (isCreate) {
      return {
        id: crypto.randomUUID(),
        title: title.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        icon: icon.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
    }
    return {
      ...workspace!.info,
      title: title.trim(),
      slug: slug.trim(),
      description: description.trim(),
      icon: icon.trim(),
    };
  }

  function handleSave() {
    if (disabled) return;
    if (isCreate) {
      const info = buildWorkspaceInfo();
      const ws: Workspace = {
        info,
        connection: {
          cachedInfo: info,
          url: connectionUrl || remoteUrl,
          type: connectionUrl || remoteUrl ? ConnectionType.remote : ConnectionType.local,
        },
        connectionState: { success: true },
      };
      addWorkspace(ws);
      props.onCreate?.(ws);
      toast("Workspace created");
      return;
    }
    const updated = buildWorkspaceInfo();
    updateWorkspace(updated);
    toast("Workspace has been updated.");
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
          <label className="mb-1 text-gray-300" htmlFor={`ws-title-${workspace?.info.id || 'new'}`}>Title</label>
          <input
            id={`ws-title-${workspace?.info.id || 'new'}`}
            className="px-2 py-1 rounded bg-gray-800 text-white border border-gray-600 disabled:text-white/50  disabled:cursor-not-allowed"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={readOnly}
            placeholder="Workspace title"
          />
        </div>
        <div className="flex flex-col w-28">
          <label className="mb-1 text-gray-300" htmlFor={`ws-icon-${workspace?.info.id || 'new'}`}>Icon</label>
          <input
            id={`ws-icon-${workspace?.info.id || 'new'}`}
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
        <label className="mb-1 text-gray-300" htmlFor={`ws-slug-${workspace?.info.id || 'new'}`}>Slug</label>
        <input
          id={`ws-slug-${workspace?.info.id || 'new'}`}
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
        <label className="mb-1 text-gray-300" htmlFor={`ws-desc-${workspace?.info.id || 'new'}`}>Description</label>
        <textarea
          id={`ws-desc-${workspace?.info.id || 'new'}`}
          className="px-2 py-1 rounded bg-gray-800 text-white border border-gray-600 resize-none h-20 disabled:text-white/50  disabled:cursor-not-allowed"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={readOnly}
          placeholder="Short description"
        />
      </div>
      {!isCreate && workspace!.connection?.url !== undefined && (
        <div className="flex flex-col">
          <label className="mb-1 text-gray-300" htmlFor={`ws-url-${workspace!.info.id}`}>Remote URL</label>
          <div
            id={`ws-url-${workspace!.info.id}`}
            className="px-2 py-1 rounded bg-gray-800 text-white/50 border border-gray-600"
          >
            {connectionUrl}
          </div>
        </div>
      )}
      {isCreate && connectionUrl && (
        <div className="flex flex-col">
          <label className="mb-1 text-gray-300" htmlFor={`ws-url-new`}>Remote URL</label>
          <div id={`ws-url-new`} className="px-2 py-1 rounded bg-gray-800 text-white/50 border border-gray-600">
            {connectionUrl}
          </div>
        </div>
      )}

      {!readOnly && (
        <div className="flex gap-2 mt-2">
          <button
            type="submit"
            className="px-3 py-1 ml-auto bg-blue-600 text-white rounded disabled:bg-gray-600 flex items-center gap-2 cursor-pointer"
            disabled={disabled}
          >
            {isCreate ? <><PlusIcon className="w-4" /> Create</> : <><SaveIcon className="w-4" /> Save</>}
          </button>
        </div>
      )}
    </form>
  );
}
