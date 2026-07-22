import { useEffect, useState } from "react";
import { EmojiIcon } from "../components/emoji/EmojiIcon";
import { useTabs } from "../context/TabContext";
import { useWorkspacePages } from "../hooks/useWorkspacePages";
import { cn } from "../lib/utils";
import {
  buildPageSegment,
  pageLabel,
  type SearchPageHit,
} from "../types/page";

const DEBOUNCE_MS = 300;

export function SearchPage() {
  const { searchPages, findPageById } = useWorkspacePages();
  const { navigateInTab } = useTabs();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchPageHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setError(null);
      setLoading(false);
      setHasSearched(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const hits = await searchPages(trimmed);
          if (cancelled) return;
          setResults(hits);
          setError(null);
          setHasSearched(true);
        } catch (err) {
          if (cancelled) return;
          setResults([]);
          setError(err instanceof Error ? err.message : "Search failed");
          setHasSearched(true);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, searchPages]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-50">
          Search
        </h1>
        <p className="text-sm text-stone-700 dark:text-stone-300">
          Find pages by title, slug, or content.
        </p>
      </div>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search pages…"
        autoFocus
        className={cn(
          "w-full rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-3 text-base",
          "text-stone-900 placeholder:text-stone-500 outline-none",
          "focus:border-stone-400 dark:text-stone-50 dark:placeholder:text-stone-400 dark:focus:border-stone-500",
        )}
      />

      {error && (
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
      )}

      {!query.trim() ? (
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Start typing to search the workspace.
        </p>
      ) : loading ? (
        <p className="text-sm text-stone-600 dark:text-stone-400">Searching…</p>
      ) : hasSearched && results.length === 0 ? (
        <p className="text-sm text-stone-600 dark:text-stone-400">
          No pages matched “{query.trim()}”.
        </p>
      ) : (
        <ul className="space-y-2">
          {results.map((page) => (
            <li key={page.id}>
              <button
                type="button"
                onClick={() =>
                  navigateInTab(buildPageSegment(page, findPageById), {
                    label: pageLabel(page),
                    icon: page.icon,
                    pageId: page.id,
                  })
                }
                className={cn(
                  "flex w-full items-start gap-3 rounded-md border border-[var(--app-border)] bg-[var(--app-bg)]/50 px-3 py-2 text-left",
                  "hover:bg-stone-100/80 dark:hover:bg-stone-800/80",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {page.icon && <EmojiIcon icon={page.icon} size={16} />}
                    <span className="truncate font-medium text-stone-900 dark:text-stone-50">
                      {pageLabel(page)}
                    </span>
                  </div>
                  {page.snippet && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-stone-600 dark:text-stone-400">
                      {page.snippet}
                    </p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
