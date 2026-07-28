import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "../context/WorkspaceContext";
import { cn, formatUnknownError } from "../lib/utils";

export type GitFileChangeStatus =
  | "added"
  | "modified"
  | "deleted"
  | "untracked"
  | "renamed"
  | "typechange"
  | "conflicted";

export type GitFileChange = {
  path: string;
  status: GitFileChangeStatus;
};

export type GitRemote = {
  name: string;
  url: string;
};

export type GitStatus = {
  branch: string;
  upstream?: string | null;
  ahead: number;
  behind: number;
  headMessage?: string | null;
  commitTitle: string;
  files: GitFileChange[];
  remotes: GitRemote[];
  hasUpstream: boolean;
  canPush: boolean;
};

function statusLabel(status: GitFileChangeStatus) {
  switch (status) {
    case "added":
      return "Added";
    case "modified":
      return "Modified";
    case "deleted":
      return "Deleted";
    case "untracked":
      return "Untracked";
    case "renamed":
      return "Renamed";
    case "typechange":
      return "Type change";
    case "conflicted":
      return "Conflicted";
  }
}

function statusClassName(status: GitFileChangeStatus) {
  switch (status) {
    case "added":
    case "untracked":
      return "text-green-700 dark:text-green-400";
    case "modified":
    case "renamed":
    case "typechange":
      return "text-amber-700 dark:text-amber-400";
    case "deleted":
    case "conflicted":
      return "text-red-700 dark:text-red-400";
  }
}

export function SyncPage() {
  const { rpc, connectionStatus } = useWorkspace();
  const [status, setStatus] = useState<GitStatus | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"commit" | "push" | "pull" | "refresh" | null>(
    null,
  );

  const loadStatus = useCallback(async () => {
    if (!rpc || connectionStatus !== "connected") {
      setStatus(undefined);
      return;
    }
    setError(null);
    try {
      const result = await rpc.call<GitStatus>("git_status");
      setStatus(result);
    } catch (err) {
      setStatus(undefined);
      setError(formatUnknownError(err, "Failed to load git status"));
    }
  }, [rpc, connectionStatus]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleRefresh = async () => {
    setBusy("refresh");
    try {
      await loadStatus();
    } finally {
      setBusy(null);
    }
  };

  const handleCommit = async () => {
    if (!rpc || connectionStatus !== "connected") return;
    setBusy("commit");
    setError(null);
    try {
      const result = await rpc.call<GitStatus>("git_commit");
      setStatus(result);
    } catch (err) {
      setError(formatUnknownError(err, "Failed to commit"));
    } finally {
      setBusy(null);
    }
  };

  const handlePush = async () => {
    if (!rpc || connectionStatus !== "connected") return;
    setBusy("push");
    setError(null);
    try {
      const result = await rpc.call<GitStatus>("git_push");
      setStatus(result);
    } catch (err) {
      setError(formatUnknownError(err, "Failed to push"));
    } finally {
      setBusy(null);
    }
  };

  const handlePull = async () => {
    if (!rpc || connectionStatus !== "connected") return;
    setBusy("pull");
    setError(null);
    try {
      const result = await rpc.call<GitStatus>("git_pull");
      setStatus(result);
    } catch (err) {
      setError(formatUnknownError(err, "Failed to fetch & pull"));
    } finally {
      setBusy(null);
    }
  };

  if (connectionStatus !== "connected") {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 p-4">
        <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-50">
          Sync
        </h1>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          {connectionStatus === "disconnected"
            ? "Reconnecting to the workspace…"
            : "Connect to a workspace to view git sync status."}
        </p>
      </div>
    );
  }

  if (status === undefined && !error) {
    return null;
  }

  const dirty = (status?.files.length ?? 0) > 0;
  const commitTitle = status?.commitTitle ?? "";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-50">
            Sync
          </h1>
          <p className="text-sm text-stone-700 dark:text-stone-300">
            Changes are committed once per day as{" "}
            <span className="font-mono">{commitTitle || "yyyy-mm-dd"}</span>.
          </p>
        </div>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void handleRefresh()}
          className={cn(
            "shrink-0 rounded-md border border-app-border px-3 py-1.5 text-sm text-stone-800",
            "hover:bg-stone-100 disabled:opacity-50 dark:text-stone-200 dark:hover:bg-stone-800",
          )}
        >
          {busy === "refresh" ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
      )}

      {status && (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-stone-900 dark:text-stone-50">
              Status
            </h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
              <dt className="text-stone-600 dark:text-stone-400">Branch</dt>
              <dd className="font-mono text-stone-900 dark:text-stone-100">
                {status.branch}
              </dd>
              <dt className="text-stone-600 dark:text-stone-400">Upstream</dt>
              <dd className="font-mono text-stone-900 dark:text-stone-100">
                {status.upstream ?? "None"}
              </dd>
              <dt className="text-stone-600 dark:text-stone-400">Remote</dt>
              <dd className="min-w-0 text-stone-900 dark:text-stone-100">
                {status.remotes.length === 0 ? (
                  "None"
                ) : (
                  <ul className="space-y-1">
                    {status.remotes.map((remote) => (
                      <li key={remote.name} className="min-w-0">
                        <span className="font-mono">{remote.name}</span>
                        {remote.url ? (
                          <span className="mt-0.5 block truncate font-mono text-xs text-stone-600 dark:text-stone-400">
                            {remote.url}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
              <dt className="text-stone-600 dark:text-stone-400">Working tree</dt>
              <dd className="text-stone-900 dark:text-stone-100">
                {dirty ? "Dirty" : "Clean"}
              </dd>
              <dt className="text-stone-600 dark:text-stone-400">Sync</dt>
              <dd className="text-stone-900 dark:text-stone-100">
                {status.hasUpstream
                  ? `${status.ahead} ahead · ${status.behind} behind`
                  : "No upstream"}
              </dd>
              {status.headMessage ? (
                <>
                  <dt className="text-stone-600 dark:text-stone-400">
                    Latest commit
                  </dt>
                  <dd className="font-mono text-stone-900 dark:text-stone-100">
                    {status.headMessage}
                  </dd>
                </>
              ) : null}
            </dl>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={busy !== null || !dirty}
                onClick={() => void handleCommit()}
                className={cn(
                  "rounded-md bg-stone-800 px-3 py-1.5 text-sm font-medium text-stone-50",
                  "hover:bg-stone-700 disabled:opacity-50",
                  "dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-stone-100",
                )}
              >
                {busy === "commit"
                  ? "Committing…"
                  : `Commit as ${commitTitle}`}
              </button>
              <button
                type="button"
                disabled={busy !== null || !status.hasUpstream}
                onClick={() => void handlePull()}
                className={cn(
                  "rounded-md border border-app-border px-3 py-1.5 text-sm text-stone-800",
                  "hover:bg-stone-100 disabled:opacity-50 dark:text-stone-200 dark:hover:bg-stone-800",
                )}
              >
                {busy === "pull" ? "Pulling…" : "Fetch & pull"}
              </button>
              <button
                type="button"
                disabled={busy !== null || !status.canPush}
                onClick={() => void handlePush()}
                className={cn(
                  "rounded-md border border-app-border px-3 py-1.5 text-sm text-stone-800",
                  "hover:bg-stone-100 disabled:opacity-50 dark:text-stone-200 dark:hover:bg-stone-800",
                )}
              >
                {busy === "push"
                  ? "Pushing…"
                  : status.behind > 0
                    ? "Force push"
                    : "Push"}
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-stone-900 dark:text-stone-50">
              Changed files
            </h2>
            {status.files.length === 0 ? (
              <p className="text-sm text-stone-600 dark:text-stone-400">
                No changes since the latest commit.
              </p>
            ) : (
              <ul className="space-y-2">
                {status.files.map((file) => (
                  <li
                    key={file.path}
                    className="flex items-center justify-between gap-3 rounded-md border border-app-border bg-app-bg/50 px-3 py-2"
                  >
                    <span className="min-w-0 truncate font-mono text-sm text-stone-900 dark:text-stone-100">
                      {file.path}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-xs font-medium",
                        statusClassName(file.status),
                      )}
                    >
                      {statusLabel(file.status)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
