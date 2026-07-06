import { useCallback, useEffect, useState } from "react";
import { useTabs } from "../context/TabContext";
import { useWorkspacePages } from "../hooks/useWorkspacePages";
import { cn } from "../lib/utils";
import { buildTrashedPageSegment, type TrashedPage } from "../types/page";

function trashedPageLabel(page: TrashedPage) {
  return page.title ?? page.slug ?? page.id;
}

function formatTrashedAt(trashedAt: string) {
  const seconds = Number(trashedAt);
  if (!Number.isFinite(seconds)) return trashedAt;
  return new Date(seconds * 1000).toLocaleString();
}

export function TrashPage() {
  const { listTrashedPages, restorePage, purgePage } = useWorkspacePages();
  const { navigateInTab, closeTabsForPages } = useTabs();
  const [pages, setPages] = useState<TrashedPage[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadPages = useCallback(async () => {
    setError(null);
    try {
      const result = await listTrashedPages();
      setPages(result);
    } catch (err) {
      setPages([]);
      setError(err instanceof Error ? err.message : "Failed to load trash");
    }
  }, [listTrashedPages]);

  useEffect(() => {
    void loadPages();
  }, [loadPages]);

  const handleRestore = async (page: TrashedPage) => {
    setBusyId(page.id);
    setError(null);
    try {
      await restorePage(page.id);
      await loadPages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore page");
    } finally {
      setBusyId(null);
    }
  };

  const handlePurge = async (page: TrashedPage) => {
    setBusyId(page.id);
    setError(null);
    try {
      await purgePage(page.id);
      closeTabsForPages([page.id]);
      await loadPages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete page");
    } finally {
      setBusyId(null);
    }
  };

  const handleEmptyTrash = async () => {
    if (!pages?.length) return;
    setBusyId("__all__");
    setError(null);
    try {
      for (const page of pages) {
        await purgePage(page.id);
        closeTabsForPages([page.id]);
      }
      await loadPages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to empty trash");
    } finally {
      setBusyId(null);
    }
  };

  if (pages === undefined) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-50">
            Trash
          </h1>
          <p className="text-sm text-stone-700 dark:text-stone-300">
            Restore pages or delete them permanently.
          </p>
        </div>
        {pages.length > 0 && (
          <button
            type="button"
            disabled={busyId !== null}
            onClick={() => void handleEmptyTrash()}
            className={cn(
              "shrink-0 rounded-md border border-[var(--app-border)] px-3 py-1.5 text-sm text-stone-800",
              "hover:bg-stone-100 disabled:opacity-50 dark:text-stone-200 dark:hover:bg-stone-800",
            )}
          >
            Empty trash
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
      )}

      {pages.length === 0 ? (
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Trash is empty.
        </p>
      ) : (
        <ul className="space-y-2">
          {pages.map((page) => (
            <li
              key={page.id}
              className="flex items-center justify-between gap-3 rounded-md border border-[var(--app-border)] bg-[var(--app-bg)]/50 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {page.icon && <span>{page.icon}</span>}
                  <span className="truncate font-medium text-stone-900 dark:text-stone-50">
                    {trashedPageLabel(page)}
                  </span>
                </div>
                <p className="truncate text-xs text-stone-600 dark:text-stone-400">
                  {page.originalPath} · {formatTrashedAt(page.trashedAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() =>
                    navigateInTab(buildTrashedPageSegment(page), {
                      label: trashedPageLabel(page),
                      icon: page.icon,
                      pageId: page.id,
                    })
                  }
                  className={cn(
                    "rounded px-2 py-1 text-sm text-stone-800",
                    "hover:bg-stone-200/80 disabled:opacity-50 dark:text-stone-200 dark:hover:bg-stone-800",
                  )}
                >
                  View
                </button>
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => void handleRestore(page)}
                  className={cn(
                    "rounded px-2 py-1 text-sm text-stone-800",
                    "hover:bg-stone-200/80 disabled:opacity-50 dark:text-stone-200 dark:hover:bg-stone-800",
                  )}
                >
                  Restore
                </button>
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => void handlePurge(page)}
                  className={cn(
                    "rounded px-2 py-1 text-sm text-red-700",
                    "hover:bg-red-100/80 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40",
                  )}
                >
                  Delete forever
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
