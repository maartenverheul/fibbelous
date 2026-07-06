import { useState } from "react";
import { useSavedWorkspaces } from "../hooks/useSavedWorkspaces";
import { WorkspaceManagerDialog } from "../components/workspace/WorkspaceManagerDialog";
import { cn } from "../lib/utils";

export function LandingPage() {
  const { workspaces } = useSavedWorkspaces();
  const [managerOpen, setManagerOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          "flex min-h-screen flex-col items-center justify-center gap-3 bg-white p-6 text-center",
          "dark:bg-zinc-950",
        )}
      >
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Fibbelous
        </h1>
        <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
          {workspaces.length === 0
            ? "Add a workspace to get started."
            : "Select a workspace or add another."}
        </p>
        <button
          type="button"
          onClick={() => setManagerOpen(true)}
          className={cn(
            "rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white",
            "hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900",
          )}
        >
          Manage workspaces
        </button>
      </div>
      <WorkspaceManagerDialog open={managerOpen} onOpenChange={setManagerOpen} />
    </>
  );
}
