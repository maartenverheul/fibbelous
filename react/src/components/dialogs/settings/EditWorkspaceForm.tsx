import { useState, useMemo } from "react";
import { Workspace, CreateWorkspaceRequest } from "@/models";
import { useWorkspaceManager } from "@/contexts/WorkspaceManagerContext";
import { SaveIcon, RotateCcw } from "lucide-react";
import { IS_APP } from "@/checks";

type Props = {
  workspace?: Workspace;
  readOnly?: boolean;
  onSave(request: CreateWorkspaceRequest, url?: string): void;
  remoteUrl?: string;
};

export default function EditWorkspaceForm({
  workspace,
  onSave,
  remoteUrl,
  ...props
}: Props) {
  const { workspaces } = useWorkspaceManager();

  const isCreate = workspace === undefined;
  const readOnly = !isCreate && (props.readOnly ?? false);

  const [title, setTitle] = useState(workspace?.info.title ?? "");
  const [slug, setSlug] = useState(workspace?.info.slug ?? "");
  // Track if user manually edited slug so we stop auto-syncing from title
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(() => {
    if (isCreate) return false;
    return sanitizeSlug(workspace?.info.title) !== workspace?.info.slug; // custom slug already
  });
  const [description, setDescription] = useState(
    workspace?.info.description ?? ""
  );
  const [icon, setIcon] = useState(workspace?.info.icon ?? "");
  const [connectionUrl] = useState(
    remoteUrl ?? workspace?.connection?.url ?? ""
  );

  // Detect slug conflicts. When editing, allow keeping the original slug even if it matches.
  const slugConflict = useMemo(() => {
    if (!slug) return false;
    // If editing and slug hasn't changed, it's never a conflict
    if (!isCreate && slug === workspace!.info.slug) return false;
    return workspaces.some((w) => {
      if (!isCreate && w.info.id === workspace!.info.id) return false; // ignore the workspace being edited
      return w.info.slug === slug;
    });
  }, [slug, workspaces, isCreate, workspace]);
  const disabled = readOnly || !title.trim() || !slug.trim() || slugConflict;

  function handleSave() {
    if (disabled) return;
    let info: CreateWorkspaceRequest = {
      title: title.trim(),
      slug: slug.trim(),
      description: description.trim() || undefined,
      icon: icon.trim() || undefined,
    }
    if (!isCreate) info = { ...workspace!.info, ...info }
    onSave?.(info, connectionUrl);
  }

  function sanitizeSlug(input: string) {
    // Lowercase, replace spaces with dash, remove invalid chars (only a-z, 0-9 and dash)
    return input
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-") // collapse multiple dashes
      .replace(/^-+/, ""); // trim leading dashes
  }

  function resetSlugToAuto() {
    setSlug(sanitizeSlug(title));
    setSlugManuallyEdited(false);
  }

  const fullWorkspaceUrl = useMemo(() => {
    let base = (connectionUrl || remoteUrl || "").replace(/\/$/, "");
    if (!base && !IS_APP && typeof window !== "undefined") {
      base = window.location.origin.replace(/\/$/, "");
    }
    let previewSlug = slug || (title ? sanitizeSlug(title) : "<slug>");
    previewSlug = previewSlug.replace(/-+$/, ""); // remove trailing dashes
    return base ? `${base}/${previewSlug}` : `/${previewSlug}`;
  }, [connectionUrl, remoteUrl, slug, title]);

  return (
    <form
      className="flex flex-col gap-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      <div className="flex gap-2">
        <div className="flex flex-col w-12">
          <label
            className="mb-1 text-gray-300"
            htmlFor={`ws-icon-${workspace?.info.id || "new"}`}
          >
            Icon
          </label>
          <input
            id={`ws-icon-${workspace?.info.id || "new"}`}
            className="py-1 rounded bg-gray-800 text-white border placeholder:saturate-0 border-gray-600 disabled:text-white/50  disabled:cursor-not-allowed text-center"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            disabled={readOnly}
            placeholder="📁"
            maxLength={4}
          />
        </div>
        <div className="flex flex-col flex-1">
          <label
            className="mb-1 text-gray-300"
            htmlFor={`ws-title-${workspace?.info.id || "new"}`}
          >
            Title
          </label>
          <input
            id={`ws-title-${workspace?.info.id || "new"}`}
            className="px-2 py-1 rounded bg-gray-800 text-white border border-gray-600 disabled:text-white/50  disabled:cursor-not-allowed"
            value={title}
            onChange={(e) => {
              const v = e.target.value;
              setTitle(v);
              if (!slugManuallyEdited) {
                setSlug(sanitizeSlug(v));
              }
            }}
            disabled={readOnly}
            placeholder="Workspace title"
          />
        </div>
      </div>

      <div className="flex flex-col">
        <label
          className="mb-1 text-gray-300"
          htmlFor={`ws-slug-${workspace?.info.id || "new"}`}
        >
          Slug
        </label>
        <div className="relative">
          <input
            id={`ws-slug-${workspace?.info.id || "new"}`}
            className={`w-full pr-7 px-2 py-1 rounded bg-gray-800 text-white border ${slugConflict ? "border-red-600" : "border-gray-600"
              } disabled:text-white/50  disabled:cursor-not-allowed`}
            value={slug}
            onChange={(e) => {
              setSlug(sanitizeSlug(e.target.value));
              setSlugManuallyEdited(true);
            }}
            disabled={readOnly}
            placeholder="workspace-slug"
            pattern="[a-z-]*"
            title="Lowercase letters and dashes only"
          />
          {!readOnly && slugManuallyEdited && (
            <button
              type="button"
              onClick={resetSlugToAuto}
              className="absolute cursor-pointer right-2 inset-y-0 flex items-center justify-center text-gray-400 hover:text-white focus:outline-none"
              title="Reset slug to auto-generated from title"
              tabIndex={0}
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
        {slugConflict && (
          <span className="text-xs text-red-400 mt-1">
            Slug already in use.
          </span>
        )}
        {/* URL preview */}
        {!slugConflict && !IS_APP && (
          <span className="text-xs text-gray-500 mt-1">
            Full URL: <code className="text-gray-400">{fullWorkspaceUrl}</code>
          </span>
        )}
      </div>

      <div className="flex flex-col">
        <label
          className="mb-1 text-gray-300"
          htmlFor={`ws-desc-${workspace?.info.id || "new"}`}
        >
          Description
        </label>
        <textarea
          id={`ws-desc-${workspace?.info.id || "new"}`}
          className="px-2 py-1 rounded bg-gray-800 text-white border border-gray-600 resize-none h-20 disabled:text-white/50  disabled:cursor-not-allowed"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={readOnly}
          placeholder="Short description"
        />
      </div>
      {!isCreate && workspace!.connection?.url !== undefined && (
        <div className="flex flex-col">
          <label
            className="mb-1 text-gray-300"
            htmlFor={`ws-url-${workspace!.info.id}`}
          >
            Remote URL
          </label>
          <div
            id={`ws-url-${workspace!.info.id}`}
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
            className="px-3 py-1 ml-auto bg-emerald-600 text-white rounded disabled:bg-gray-600 flex items-center gap-2 cursor-pointer"
            disabled={disabled}
          >
            {isCreate ? (
              <span>
                Create workspace
              </span>
            ) : (
              <>
                <SaveIcon className="w-4" /> Save
              </>
            )}
          </button>
        </div>
      )}
    </form>
  );
}
