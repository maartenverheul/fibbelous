import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSavedWorkspaces } from "../hooks/useSavedWorkspaces";
import { WorkspaceManagerDialog } from "../components/workspace/WorkspaceManagerDialog";
import { cn } from "../lib/utils";
import { closePooledConnection } from "../lib/workspaceConnection";
import {
  shouldOpenWorkspaceManager,
  type LandingLocationState,
  type WorkspaceNotice,
} from "../lib/navigation";

export function LandingPage() {
  const { workspaces, setActive } = useSavedWorkspaces();
  const location = useLocation();
  const navigate = useNavigate();
  const redirectState = location.state as LandingLocationState | null;
  const [managerOpen, setManagerOpen] = useState(() =>
    shouldOpenWorkspaceManager(redirectState) ||
      Boolean(redirectState?.notice),
  );
  const [notice, setNotice] = useState<WorkspaceNotice | null>(
    () => redirectState?.notice ?? null,
  );

  useEffect(() => {
    closePooledConnection();
  }, []);

  useEffect(() => {
    if (redirectState?.notice?.kind !== "connectionFailed") return;
    setActive(null);
  }, [redirectState?.notice, setActive]);

  return (
    <>
      {!managerOpen && (
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
              ? "Connect to a server and create your first workspace."
              : "Open a saved workspace or connect to create another."}
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
      )}
      {managerOpen && (
        <div className="min-h-screen bg-[var(--app-bg)]" aria-hidden />
      )}
      <WorkspaceManagerDialog
        open={managerOpen}
        onOpenChange={(open) => {
          setManagerOpen(open);
          if (!open) {
            setNotice(null);
            if (shouldOpenWorkspaceManager(location.state)) {
              navigate(".", { replace: true, state: null });
            }
          }
        }}
        notice={notice}
      />
    </>
  );
}
