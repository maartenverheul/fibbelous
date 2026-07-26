import { useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { buildInfo } from "../lib/app/buildInfo";
import { cn } from "../lib/utils";
import { checkForAppUpdate } from "../pwa";

function formatBuildTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function SettingsPage() {
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const showUpdateCheck = !isTauri() && "serviceWorker" in navigator;

  const handleCheckForUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateStatus(null);
    try {
      const result = await checkForAppUpdate();
      if (result === "updated") {
        setUpdateStatus("Update found — reloading…");
      } else if (result === "current") {
        setUpdateStatus("You're on the latest build.");
      } else {
        setUpdateStatus("Update checks are only available in the installed web app.");
      }
    } catch {
      setUpdateStatus("Could not check for updates.");
    } finally {
      setCheckingUpdate(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-50">
          Settings
        </h1>
        <p className="text-sm text-stone-700 dark:text-stone-300">
          Application settings will live here.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-stone-900 dark:text-stone-50">
          Build
        </h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="text-stone-600 dark:text-stone-400">Version</dt>
          <dd className="font-mono text-stone-900 dark:text-stone-100">
            {buildInfo.version}
          </dd>
          <dt className="text-stone-600 dark:text-stone-400">Commit</dt>
          <dd className="font-mono text-stone-900 dark:text-stone-100">
            {buildInfo.gitCommit}
          </dd>
          <dt className="text-stone-600 dark:text-stone-400">Built</dt>
          <dd className="font-mono text-stone-900 dark:text-stone-100">
            {formatBuildTime(buildInfo.buildTime)}
          </dd>
          <dt className="text-stone-600 dark:text-stone-400">Mode</dt>
          <dd className="font-mono text-stone-900 dark:text-stone-100">
            {buildInfo.mode}
          </dd>
        </dl>

        {showUpdateCheck ? (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              disabled={checkingUpdate}
              onClick={() => void handleCheckForUpdate()}
              className={cn(
                "rounded-md border border-app-border px-3 py-1.5 text-sm text-stone-800",
                "hover:bg-stone-100 disabled:opacity-50 dark:text-stone-200 dark:hover:bg-stone-800",
              )}
            >
              {checkingUpdate ? "Checking…" : "Check for updates"}
            </button>
            {updateStatus ? (
              <p className="text-sm text-stone-600 dark:text-stone-400">
                {updateStatus}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
