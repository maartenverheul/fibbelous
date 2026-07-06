import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { usePageSave } from "../context/PageSaveContext";
import { useTabs } from "../context/TabContext";
import { useWorkspacePages } from "../hooks/useWorkspacePages";
import { cn } from "../lib/utils";
import {
  ROOT_PAGES_DIR,
  buildPageSegment,
  pageLabel,
  parentDirOfPage,
  parsePageIdFromSegment,
  slugifyPageTitle,
  type TrashedPageDetail,
  type WorkspacePageDetail,
} from "../types/page";

export function PageView() {
  const { "*": pagePath } = useParams<{ "*": string }>();
  const {
    findPageByKey,
    findPageById,
    fetchPageDetail,
    fetchTrashedPageDetail,
    updatePage,
    restorePage,
    ensureChildren,
  } = useWorkspacePages();
  const { navigateInTab } = useTabs();
  const { setStatus } = usePageSave();
  const cachedPage = pagePath ? findPageByKey(pagePath) : undefined;
  const [detail, setDetail] = useState<WorkspacePageDetail | null | undefined>(
    undefined,
  );
  const [trashedDetail, setTrashedDetail] = useState<
    TrashedPageDetail | null | undefined
  >(undefined);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [restoring, setRestoring] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedPageIdRef = useRef<string | null>(null);

  const isTrashed = trashedDetail != null;
  const page = isTrashed ? trashedDetail : (detail ?? cachedPage);

  useEffect(() => {
    if (!pagePath) {
      setDetail(undefined);
      setTrashedDetail(undefined);
      return;
    }

    const pageId = parsePageIdFromSegment(pagePath);
    if (!pageId) {
      setDetail(null);
      setTrashedDetail(null);
      return;
    }

    let cancelled = false;
    setDetail(undefined);
    setTrashedDetail(undefined);
    loadedPageIdRef.current = null;

    fetchPageDetail(pageId)
      .then((result) => {
        if (cancelled) return;
        if (result) {
          setDetail(result);
          setTrashedDetail(null);
          return;
        }

        return fetchTrashedPageDetail(pageId).then((trashed) => {
          if (!cancelled) {
            setDetail(null);
            setTrashedDetail(trashed);
          }
        });
      })
      .catch(() => {
        if (!cancelled) {
          setDetail(null);
          setTrashedDetail(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pagePath, fetchPageDetail, fetchTrashedPageDetail]);

  useEffect(() => {
    if (!pagePath || isTrashed) return;

    const pageId = parsePageIdFromSegment(pagePath);
    if (!pageId || findPageById(pageId)) return;
    if (detail === undefined) return;

    let cancelled = false;

    fetchTrashedPageDetail(pageId).then((trashed) => {
      if (!cancelled && trashed) {
        setDetail(null);
        setTrashedDetail(trashed);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pagePath, detail, isTrashed, findPageById, fetchTrashedPageDetail]);

  useEffect(() => {
    setStatus("saved");
  }, [pagePath, setStatus]);

  useEffect(() => {
    if (!page) return;
    setTitle(pageLabel(page));
  }, [page?.id, page?.title, page?.slug]);

  useEffect(() => {
    if (isTrashed && trashedDetail) {
      setBody(trashedDetail.body);
      loadedPageIdRef.current = trashedDetail.id;
      return;
    }

    if (detail?.body !== undefined) {
      setBody(detail.body);
      loadedPageIdRef.current = detail.id;
    }
  }, [detail?.id, detail?.body, isTrashed, trashedDetail]);

  useEffect(() => {
    const livePage = detail ?? cachedPage;
    if (isTrashed || !livePage) return;
    ensureChildren(ROOT_PAGES_DIR);
    ensureChildren(parentDirOfPage(livePage));
  }, [detail, cachedPage, isTrashed, ensureChildren]);

  useEffect(() => {
    if (isTrashed || !page || !detail || loadedPageIdRef.current !== page.id) {
      return;
    }

    const savedTitle = pageLabel(page);
    const savedBody = detail.body;
    if (title === savedTitle && body === savedBody) {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      setStatus("saved");
      return;
    }

    setStatus("saving");

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      updatePage(page.id, {
        title,
        body,
        slug: slugifyPageTitle(title),
      })
        .then((updated) => {
          setDetail(updated);
          setStatus("saved");
          const previousSegment = buildPageSegment(page, findPageById);
          const newSegment = buildPageSegment(updated, findPageById);
          if (newSegment !== previousSegment) {
            navigateInTab(newSegment, {
              label: pageLabel(updated),
              icon: updated.icon,
              pageId: updated.id,
            });
          }
        })
        .catch((error) => {
          console.error(error);
          setStatus("error");
        });
    }, 500);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [
    title,
    body,
    page,
    detail,
    isTrashed,
    updatePage,
    findPageById,
    navigateInTab,
    setStatus,
  ]);

  const handleRestore = async () => {
    if (!trashedDetail) return;

    setRestoring(true);
    try {
      const restored = await restorePage(trashedDetail.id);
      setTrashedDetail(null);
      setDetail(restored);
      setTitle(pageLabel(restored));
      setBody(restored.body);
      loadedPageIdRef.current = restored.id;
      navigateInTab(buildPageSegment(restored, findPageById), {
        label: pageLabel(restored),
        icon: restored.icon,
        pageId: restored.id,
      });
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Failed to restore page");
    } finally {
      setRestoring(false);
    }
  };

  if (!pagePath) {
    return null;
  }

  const loading =
    detail === undefined &&
    trashedDetail === undefined &&
    !cachedPage;

  if (loading) {
    return null;
  }

  const displayPage = cachedPage ?? detail ?? trashedDetail;
  if (!displayPage) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-2 p-4">
        <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-50">
          Page not found
        </h1>
        <p className="text-sm text-stone-700 dark:text-stone-300">
          This page does not exist or was permanently deleted.
        </p>
      </div>
    );
  }

  const bannerImage: string | null = null;

  return (
    <div className="flex min-h-full flex-col">
      {isTrashed && (
        <div
          role="status"
          className={cn(
            "flex shrink-0 items-center justify-between gap-4 border-b border-red-800/30",
            "bg-red-600 px-4 py-4 text-white sm:px-6 sm:py-5",
            "dark:border-red-900/50 dark:bg-red-950",
          )}
        >
          <div className="min-w-0 space-y-1">
            <p className="text-base font-semibold sm:text-lg">
              This page is in trash
            </p>
            <p className="text-sm text-red-100 dark:text-red-300">
              Restore it to edit again, or delete it permanently from the Trash
              page.
            </p>
          </div>
          <button
            type="button"
            disabled={restoring}
            onClick={() => void handleRestore()}
            className={cn(
              "shrink-0 rounded-md bg-white px-4 py-2 text-sm font-medium text-red-700",
              "hover:bg-red-50 disabled:opacity-50",
              "dark:bg-red-900 dark:text-red-50 dark:hover:bg-red-800",
            )}
          >
            {restoring ? "Restoring…" : "Restore page"}
          </button>
        </div>
      )}

      <header
        className={cn(
          "relative z-10 shrink-0",
          bannerImage ? "h-56 sm:h-72 md:h-80 lg:h-96" : "h-20",
        )}
      >
        <div className="absolute inset-x-0 bottom-0 translate-y-1/2">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-3 bg-(--app-surface) px-4 py-2">
            {displayPage.icon && (
              <span
                className="shrink-0 text-4xl leading-none sm:text-5xl"
                aria-hidden
              >
                {displayPage.icon}
              </span>
            )}
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              readOnly={isTrashed}
              aria-label="Page title"
              className={cn(
                "min-w-0 flex-1 border-none bg-transparent p-0 text-3xl font-semibold text-stone-900 outline-none",
                "focus:ring-0 sm:text-4xl dark:text-stone-50",
                isTrashed && "cursor-default",
              )}
            />
          </div>
        </div>
      </header>
      <div
        className={cn(
          "mx-auto w-full max-w-3xl flex-1 px-4 pb-4",
          bannerImage ? "pt-10" : "pt-20",
        )}
      >
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          readOnly={isTrashed}
          aria-label="Page content"
          className={cn(
            "min-h-[50vh] w-full resize-none border-none bg-transparent p-0",
            "font-mono text-sm leading-relaxed text-stone-800 outline-none",
            "focus:ring-0 dark:text-stone-200",
            isTrashed && "cursor-default",
          )}
        />
      </div>
    </div>
  );
}
