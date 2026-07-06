import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useWorkspacePages } from "../hooks/useWorkspacePages";
import { cn } from "../lib/utils";
import {
  ROOT_PAGES_DIR,
  pageLabel,
  parentDirOfPage,
  parsePageIdFromSegment,
  type WorkspacePageDetail,
} from "../types/page";

export function PageView() {
  const { "*": pagePath } = useParams<{ "*": string }>();
  const { findPageByKey, fetchPageDetail, ensureChildren } = useWorkspacePages();
  const cachedPage = pagePath ? findPageByKey(pagePath) : undefined;
  const [detail, setDetail] = useState<WorkspacePageDetail | null | undefined>(
    undefined,
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const page = detail ?? cachedPage;

  useEffect(() => {
    if (!pagePath) {
      setDetail(undefined);
      return;
    }

    const pageId = parsePageIdFromSegment(pagePath);
    if (!pageId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetail(undefined);

    fetchPageDetail(pageId)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });

    return () => {
      cancelled = true;
    };
  }, [pagePath, fetchPageDetail]);

  useEffect(() => {
    if (!page) return;
    setTitle(pageLabel(page));
  }, [page?.id, page?.title, page?.slug]);

  useEffect(() => {
    if (detail?.body !== undefined) {
      setBody(detail.body);
    }
  }, [detail?.id, detail?.body]);

  useEffect(() => {
    if (!page) return;
    ensureChildren(ROOT_PAGES_DIR);
    ensureChildren(parentDirOfPage(page));
  }, [page, ensureChildren]);

  if (!pagePath) {
    return null;
  }

  if (!cachedPage && detail === undefined) {
    return null;
  }

  const displayPage = cachedPage ?? detail;
  if (!displayPage) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Page not found
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Page not found in workspace index.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <input
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        aria-label="Page title"
        className={cn(
          "w-full border-none bg-transparent p-0 text-3xl font-semibold text-zinc-900 outline-none",
          "focus:ring-0 dark:text-zinc-100",
        )}
      />
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        aria-label="Page content"
        className={cn(
          "min-h-0 flex-1 resize-none border-none bg-transparent p-0",
          "font-mono text-sm leading-relaxed text-zinc-800 outline-none",
          "focus:ring-0 dark:text-zinc-200",
        )}
      />
    </div>
  );
}
