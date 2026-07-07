import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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

type PageLoadStatus = "idle" | "loading" | "ready" | "missing";
type PageDraft = { title: string; body: string };

type PageEditorProps = {
  icon?: string | null;
  title: string;
  body: string;
  readOnly: boolean;
  restoring: boolean;
  showTrashBanner: boolean;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onRestore: () => void;
};

function PageEditor({
  icon,
  title,
  body,
  readOnly,
  restoring,
  showTrashBanner,
  onTitleChange,
  onBodyChange,
  onRestore,
}: PageEditorProps) {
  return (
    <div className="flex min-h-full flex-col">
      {showTrashBanner && (
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
            onClick={onRestore}
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

      <header className="relative z-10 h-20 shrink-0">
        <div className="absolute inset-x-0 bottom-0 translate-y-1/2">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-3 bg-(--app-surface) px-4 py-2">
            {icon && (
              <span
                className="shrink-0 text-4xl leading-none sm:text-5xl"
                aria-hidden
              >
                {icon}
              </span>
            )}
            <input
              type="text"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              readOnly={readOnly}
              aria-label="Page title"
              className={cn(
                "min-w-0 flex-1 border-none bg-transparent p-0 text-3xl font-semibold text-stone-900 outline-none",
                "focus:ring-0 sm:text-4xl dark:text-stone-50",
                readOnly && "cursor-default",
              )}
            />
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 pt-20 pb-4">
        <textarea
          value={body}
          onChange={(event) => onBodyChange(event.target.value)}
          readOnly={readOnly}
          aria-label="Page content"
          className={cn(
            "min-h-[50vh] w-full resize-none border-none bg-transparent p-0",
            "font-mono text-sm leading-relaxed text-stone-800 outline-none",
            "focus:ring-0 dark:text-stone-200",
            readOnly && "cursor-default",
          )}
        />
      </div>
    </div>
  );
}

function draftFromDetail(detail: WorkspacePageDetail): PageDraft {
  return { title: pageLabel(detail), body: detail.body };
}

function draftFromTrashed(trashed: TrashedPageDetail): PageDraft {
  return { title: pageLabel(trashed), body: trashed.body };
}

function draftFromPage(
  pageId: string,
  getPageDetailById: (id: string) => WorkspacePageDetail | undefined,
  findPageById: (id: string) => { title: string | null; slug: string | null; id: string } | undefined,
): PageDraft {
  const detail = getPageDetailById(pageId);
  if (detail) return draftFromDetail(detail);

  const page = findPageById(pageId);
  return { title: page ? pageLabel(page) : "", body: "" };
}

export function PageView() {
  const { "*": pagePath } = useParams<{ "*": string }>();
  const {
    findPageById,
    getPageDetailById,
    fetchPageDetail,
    fetchTrashedPageDetail,
    updatePage,
    restorePage,
    ensureChildren,
    connectionStatus,
  } = useWorkspacePages();
  const { navigateInTab } = useTabs();
  const { setStatus } = usePageSave();
  const pageId = pagePath ? parsePageIdFromSegment(pagePath) : null;
  const cachedPage = pageId ? findPageById(pageId) : undefined;
  const cachedDetail = pageId ? getPageDetailById(pageId) : undefined;
  const draftsRef = useRef(new Map<string, PageDraft>());
  const dirtyPageIdsRef = useRef(new Set<string>());
  const [editorPageId, setEditorPageId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [detail, setDetail] = useState<WorkspacePageDetail | null>(null);
  const [trashedDetail, setTrashedDetail] = useState<TrashedPageDetail | null>(
    null,
  );
  const [loadState, setLoadState] = useState<{
    pageId: string | null;
    status: PageLoadStatus;
  }>({ pageId: null, status: "idle" });
  const [restoring, setRestoring] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchSettledPageIdRef = useRef<string | null>(null);

  const loadStatus =
    loadState.pageId === pageId ? loadState.status : "loading";
  const markLoadStatus = useCallback(
    (status: PageLoadStatus, forPageId: string | null = pageId) => {
      setLoadState({ pageId: forPageId, status });
    },
    [pageId],
  );

  useLayoutEffect(() => {
    if (!pageId) {
      fetchSettledPageIdRef.current = null;
      return;
    }

    fetchSettledPageIdRef.current = null;

    const knownDetail = getPageDetailById(pageId);
    if (knownDetail) {
      setDetail(knownDetail);
      setTrashedDetail(null);
      markLoadStatus("ready", pageId);
      return;
    }

    setTrashedDetail(null);
    setDetail((current) => (current?.id === pageId ? current : null));
    markLoadStatus("loading", pageId);
  }, [pageId, getPageDetailById, markLoadStatus]);

  if (pageId !== editorPageId) {
    const nextDraft = pageId
      ? dirtyPageIdsRef.current.has(pageId)
        ? (draftsRef.current.get(pageId) ??
          draftFromPage(pageId, getPageDetailById, findPageById))
        : draftFromPage(pageId, getPageDetailById, findPageById)
      : { title: "", body: "" };

    if (pageId) {
      draftsRef.current.set(pageId, nextDraft);
    }

    setEditorPageId(pageId);
    setTitle(nextDraft.title);
    setBody(nextDraft.body);
  }

  const activeDetail =
    detail?.id === pageId ? detail : cachedDetail ?? undefined;
  const isTrashed = trashedDetail?.id === pageId;
  const page = isTrashed ? trashedDetail : (activeDetail ?? cachedPage);

  const setDraft = useCallback(
    (nextTitle: string, nextBody: string) => {
      setTitle(nextTitle);
      setBody(nextBody);
      if (pageId) {
        dirtyPageIdsRef.current.add(pageId);
        draftsRef.current.set(pageId, { title: nextTitle, body: nextBody });
      }
    },
    [pageId],
  );

  const applyDetail = useCallback(
    (nextDetail: WorkspacePageDetail, forPageId: string = pageId ?? "") => {
      const nextDraft = draftFromDetail(nextDetail);
      draftsRef.current.set(forPageId, nextDraft);
      if (!dirtyPageIdsRef.current.has(forPageId)) {
        if (forPageId === pageId) {
          setTitle(nextDraft.title);
          setBody(nextDraft.body);
        }
      }
      setDetail(nextDetail);
      setTrashedDetail(null);
    },
    [pageId],
  );

  const applyTrashed = useCallback(
    (trashed: TrashedPageDetail, forPageId: string = pageId ?? "") => {
      const nextDraft = draftFromTrashed(trashed);
      draftsRef.current.set(forPageId, nextDraft);
      if (!dirtyPageIdsRef.current.has(forPageId)) {
        if (forPageId === pageId) {
          setTitle(nextDraft.title);
          setBody(nextDraft.body);
        }
      }
      setDetail(null);
      setTrashedDetail(trashed);
    },
    [pageId],
  );

  useEffect(() => {
    if (!pagePath) {
      setDetail(null);
      setTrashedDetail(null);
      markLoadStatus("idle", null);
      return;
    }

    if (!pageId) {
      setDetail(null);
      setTrashedDetail(null);
      markLoadStatus("missing", null);
      return;
    }

    const knownDetail = getPageDetailById(pageId);
    if (knownDetail) {
      setDetail(knownDetail);
      setTrashedDetail(null);
      markLoadStatus("ready");
      fetchSettledPageIdRef.current = pageId;
      return;
    }

    if (connectionStatus !== "connected") {
      markLoadStatus("loading");
      return;
    }

    let cancelled = false;
    markLoadStatus("loading");

    void (async () => {
      try {
        const result = await fetchPageDetail(pageId);
        if (cancelled) return;

        if (result) {
          applyDetail(result, pageId);
          markLoadStatus("ready");
          fetchSettledPageIdRef.current = pageId;
          return;
        }

        const trashed = await fetchTrashedPageDetail(pageId);
        if (cancelled) return;

        if (trashed) {
          applyTrashed(trashed, pageId);
          markLoadStatus("ready");
          fetchSettledPageIdRef.current = pageId;
          return;
        }

        setDetail(null);
        setTrashedDetail(null);
        markLoadStatus("missing");
        fetchSettledPageIdRef.current = pageId;
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        markLoadStatus("loading");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    pagePath,
    pageId,
    connectionStatus,
    getPageDetailById,
    fetchPageDetail,
    fetchTrashedPageDetail,
    markLoadStatus,
    applyDetail,
    applyTrashed,
  ]);

  useLayoutEffect(() => {
    if (!pageId) return;
    if (!dirtyPageIdsRef.current.has(pageId)) {
      setStatus("saved");
    }
  }, [pageId, setStatus]);

  useEffect(() => {
    const livePage = activeDetail ?? cachedPage;
    if (isTrashed || !livePage) return;
    ensureChildren(ROOT_PAGES_DIR);
    ensureChildren(parentDirOfPage(livePage));
  }, [activeDetail, cachedPage, isTrashed, ensureChildren]);

  useEffect(() => {
    if (isTrashed || !page || !activeDetail || pageId !== editorPageId) {
      return;
    }

    const savedTitle = pageLabel(page);
    const savedBody = activeDetail.body;
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
          dirtyPageIdsRef.current.delete(page.id);
          applyDetail(updated, page.id);
          setStatus("saved");
          const previousSegment = buildPageSegment(activeDetail, findPageById);
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
    pageId,
    editorPageId,
    activeDetail,
    isTrashed,
    updatePage,
    findPageById,
    navigateInTab,
    setStatus,
    applyDetail,
  ]);

  const handleRestore = async () => {
    if (!trashedDetail) return;

    setRestoring(true);
    try {
      const restored = await restorePage(trashedDetail.id);
      applyDetail(restored, restored.id);
      markLoadStatus("ready");
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

  const hasPageEvidence = Boolean(page || cachedPage || cachedDetail);
  const showNotFound =
    !hasPageEvidence &&
    loadStatus === "missing" &&
    fetchSettledPageIdRef.current === pageId;

  if (!pagePath) {
    return null;
  }

  if (showNotFound) {
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

  return (
    <PageEditor
      icon={page?.icon}
      title={title}
      body={body}
      readOnly={isTrashed}
      restoring={restoring}
      showTrashBanner={isTrashed}
      onTitleChange={(value) => setDraft(value, body)}
      onBodyChange={(value) => setDraft(title, value)}
      onRestore={() => void handleRestore()}
    />
  );
}
