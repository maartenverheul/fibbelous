import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { PageBodyEditor } from "../components/page/PageBodyEditor";
import { PageDatabaseView } from "../components/page/PageDatabaseView";
import { PageIconPicker } from "../components/page/PageIconPicker";
import { EmojiIcon } from "../components/emoji/EmojiIcon";
import { usePageSave } from "../context/PageSaveContext";
import { useTabs } from "../context/TabContext";
import { useWorkspacePages } from "../hooks/useWorkspacePages";
import { isDatabaseOnlyBody } from "../lib/databaseBlock";
import { cn } from "../lib/utils";
import { bodyMatchesStored } from "../lib/pageBodyTitle";
import {
  buildBodyPatch,
  isBodyHashMismatchError,
  shouldSendBodyPatch,
} from "../lib/pageBodySync";
import {
  ROOT_PAGES_DIR,
  buildPageSegment,
  pageLabel,
  parentDirOfPage,
  parsePageIdFromSegment,
  slugifyPageTitle,
  type BodyPatch,
  type TrashedPageDetail,
  type WorkspacePageDetail,
} from "../types/page";

type PageLoadStatus = "idle" | "loading" | "ready" | "missing";
type PageDraft = { title: string; body: string };
type SyncedBody = { body: string; hash: string };

type PageEditorProps = {
  pageId: string;
  icon?: string | null;
  title: string;
  body: string;
  isBodyReady: boolean;
  readOnly: boolean;
  restoring: boolean;
  showTrashBanner: boolean;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onIconChange?: (icon: string) => void;
  onRestore: () => void;
};

function PageEditor({
  pageId,
  icon,
  title,
  body,
  isBodyReady,
  readOnly,
  restoring,
  showTrashBanner,
  onTitleChange,
  onBodyChange,
  onIconChange,
  onRestore,
}: PageEditorProps) {
  const databasePage = isDatabaseOnlyBody(body);

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

      <header
        className={cn("relative z-10 shrink-0", icon ? "h-20" : "h-24")}
      >
        <div className="absolute inset-x-0 bottom-0 translate-y-1/2">
          <div
            className={cn(
              "mx-auto w-full max-w-3xl bg-(--app-surface) px-4 py-2",
              icon ? "flex items-center gap-3" : "flex flex-col gap-1",
            )}
          >
            {onIconChange ? (
              <PageIconPicker icon={icon} onSelect={onIconChange} />
            ) : (
              icon && (
                <>
                  <EmojiIcon icon={icon} size={56} className="shrink-0 sm:hidden" />
                  <EmojiIcon
                    icon={icon}
                    size={64}
                    className="hidden shrink-0 sm:inline-flex"
                  />
                </>
              )
            )}
            <input
              type="text"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              readOnly={readOnly}
              aria-label="Page title"
              className={cn(
                "min-w-0 w-full border-none bg-transparent p-0 text-3xl font-semibold text-stone-900 outline-none",
                "focus:ring-0 sm:text-4xl dark:text-stone-50",
                icon && "flex-1",
                readOnly && "cursor-default",
              )}
            />
          </div>
        </div>
      </header>
      <div
        className={cn(
          "mx-auto w-full flex-1 pb-48",
          databasePage
            ? "page-database-body max-w-none px-4 sm:px-6 lg:px-8"
            : "max-w-3xl px-4",
          icon ? "pt-20" : "pt-24",
        )}
      >
        {isBodyReady ? (
          databasePage ? (
            <PageDatabaseView key={pageId} body={body} />
          ) : (
            <PageBodyEditor
              key={pageId}
              pageId={pageId}
              body={body}
              readOnly={readOnly}
              onBodyChange={onBodyChange}
            />
          )
        ) : (
          <div
            className="min-h-6 animate-pulse rounded bg-stone-100 dark:bg-stone-800"
            aria-busy
            aria-label="Loading page content"
          />
        )}
      </div>
    </div>
  );
}

function draftFromDetail(detail: WorkspacePageDetail): PageDraft {
  return {
    title: pageLabel(detail),
    body: detail.body,
  };
}

function draftFromTrashed(trashed: TrashedPageDetail): PageDraft {
  return {
    title: pageLabel(trashed),
    body: trashed.body,
  };
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
  const syncedBodyByPageIdRef = useRef(new Map<string, SyncedBody>());
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
  const fetchPageDetailRef = useRef(fetchPageDetail);
  const fetchTrashedPageDetailRef = useRef(fetchTrashedPageDetail);
  fetchPageDetailRef.current = fetchPageDetail;
  fetchTrashedPageDetailRef.current = fetchTrashedPageDetail;

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
      syncedBodyByPageIdRef.current.set(pageId, {
        body: knownDetail.body,
        hash: knownDetail.bodyHash,
      });
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
      syncedBodyByPageIdRef.current.set(forPageId, {
        body: nextDetail.body,
        hash: nextDetail.bodyHash,
      });
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

    if (connectionStatus !== "connected") {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        // Use refs so storing the fetched detail (which recreates provider
        // callbacks) does not re-trigger this effect into a get_page loop.
        const result = await fetchPageDetailRef.current(pageId);
        if (cancelled) return;

        if (result) {
          applyDetail(result, pageId);
          markLoadStatus("ready");
          fetchSettledPageIdRef.current = pageId;
          return;
        }

        const trashed = await fetchTrashedPageDetailRef.current(pageId);
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
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pagePath, pageId, connectionStatus, markLoadStatus, applyDetail, applyTrashed]);

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

  // Keep a sync base for diff saves even if the layout-effect path was skipped.
  useEffect(() => {
    if (!activeDetail?.id || activeDetail.bodyHash == null) return;
    const existing = syncedBodyByPageIdRef.current.get(activeDetail.id);
    if (existing) return;
    syncedBodyByPageIdRef.current.set(activeDetail.id, {
      body: activeDetail.body,
      hash: activeDetail.bodyHash,
    });
  }, [activeDetail]);

  useEffect(() => {
    if (isTrashed || !page || !activeDetail || pageId !== editorPageId) {
      return;
    }

    const savedTitle = pageLabel(page);
    const savedBody = activeDetail.body;
    if (title === savedTitle && bodyMatchesStored(body, savedBody)) {
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
      const titleChanged = title !== savedTitle;
      const bodyChanged = !bodyMatchesStored(body, savedBody);
      const pageIdForSave = page.id;
      const activeDetailForSave = activeDetail;

      void (async () => {
        const meta = titleChanged
          ? { title, slug: slugifyPageTitle(title) }
          : {};

        let bodyFields: { body?: string; bodyPatch?: BodyPatch } = {};

        if (bodyChanged) {
          const synced =
            syncedBodyByPageIdRef.current.get(pageIdForSave) ??
            (activeDetailForSave.bodyHash
              ? {
                  body: activeDetailForSave.body,
                  hash: activeDetailForSave.bodyHash,
                }
              : undefined);

          if (synced) {
            const patch = await buildBodyPatch(synced.body, body);
            if (shouldSendBodyPatch(patch, body)) {
              bodyFields = { bodyPatch: patch };
            } else {
              bodyFields = { body };
            }
          } else {
            bodyFields = { body };
          }
        }

        const finishSave = (updated: WorkspacePageDetail) => {
          dirtyPageIdsRef.current.delete(pageIdForSave);
          applyDetail(updated, pageIdForSave);
          // Anchor the next diff on the body we actually sent (editor truth),
          // using the server-verified hash from the response.
          syncedBodyByPageIdRef.current.set(pageIdForSave, {
            body: bodyChanged ? body : updated.body,
            hash: updated.bodyHash,
          });
          setStatus("saved");
          const previousSegment = buildPageSegment(
            activeDetailForSave,
            findPageById,
          );
          const newSegment = buildPageSegment(updated, findPageById);
          if (newSegment !== previousSegment) {
            navigateInTab(newSegment, {
              label: pageLabel(updated),
              icon: updated.icon,
              pageId: updated.id,
            });
          }
        };

        try {
          const updated = await updatePage(pageIdForSave, {
            ...meta,
            ...bodyFields,
          });
          finishSave(updated);
        } catch (error) {
          if (
            bodyChanged &&
            bodyFields.bodyPatch &&
            isBodyHashMismatchError(error)
          ) {
            try {
              const fresh = await fetchPageDetailRef.current(pageIdForSave);
              if (fresh) {
                syncedBodyByPageIdRef.current.set(pageIdForSave, {
                  body: fresh.body,
                  hash: fresh.bodyHash,
                });
              }
              const updated = await updatePage(pageIdForSave, {
                ...meta,
                body,
              });
              finishSave(updated);
              return;
            } catch (retryError) {
              console.error(retryError);
              setStatus("error");
              return;
            }
          }
          console.error(error);
          setStatus("error");
        }
      })();
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

  const handleIconChange = useCallback(
    async (icon: string) => {
      if (isTrashed || !page) return;

      try {
        const updated = await updatePage(page.id, { icon });
        applyDetail(updated, page.id);
      } catch (error) {
        console.error(error);
      }
    },
    [isTrashed, page, updatePage, applyDetail],
  );

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

  const hasDirtyDraft = pageId !== null && dirtyPageIdsRef.current.has(pageId);
  const isBodyReady = loadStatus === "ready" || hasDirtyDraft;
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
      pageId={pageId ?? ""}
      icon={page?.icon}
      title={title}
      body={body}
      isBodyReady={isBodyReady}
      readOnly={isTrashed}
      restoring={restoring}
      showTrashBanner={isTrashed}
      onTitleChange={(value) => setDraft(value, body)}
      onBodyChange={(value) => setDraft(title, value)}
      onIconChange={isTrashed ? undefined : (value) => void handleIconChange(value)}
      onRestore={() => void handleRestore()}
    />
  );
}
