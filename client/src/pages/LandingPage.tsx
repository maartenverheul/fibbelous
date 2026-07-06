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
          "flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--app-bg)] p-6 text-center",
        )}
      >
        <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-50">
          Fibbelous
        </h1>
        <p className="max-w-sm text-sm text-stone-700 dark:text-stone-300">
          {workspaces.length === 0
            ? "Add a workspace to get started."
            : "Select a workspace or add another."}
        </p>
        <button
          type="button"
          onClick={() => setManagerOpen(true)}
          className={cn(
            "rounded-md bg-stone-800 px-3 py-1.5 text-sm text-stone-50",
            "hover:bg-stone-700 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-stone-100",
          )}
        >
          Manage workspaces
        </button>
      </div>
      <WorkspaceManagerDialog open={managerOpen} onOpenChange={setManagerOpen} />
    </>
  );
}
