import { Page, TOCItem } from "@/models";
import { createContext, useContext, useEffect, useMemo, useState, useRef } from "react";
import { useDebouncedCallback } from "use-debounce";
import { usePageManager } from "./PageManagerContext";
import { useAppNavigation } from "./AppNavigationContext";
import { useServer } from "./ServerContext";

type SyncStatus = "loading" | "up-to-date" | "pending" | "error";

export type PageContextType = {
  data: Page | undefined;
  breadcrumbs: TOCItem[];
  loaded: boolean;
  content: string;
  syncStatus: SyncStatus;
  deletePage: (id: string) => void;
  updateTitle: (newTitle: string) => void;
  updateIcon: (newIcon: string) => void;
  updateContent: (newContent: string) => void;
};

const PageContext = createContext<PageContextType | undefined>(undefined);

type Props = {
  children: React.ReactNode;
};

export function PageProvider({ children }: Props) {
  const appNavigation = useAppNavigation();
  const server = useServer();
  const pageManager = usePageManager();
  const [data, setData] = useState<Page>();
  const [loaded, setLoaded] = useState(false);
  const [content, setContent] = useState<string>("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");

  useEffect(() => {
    const pageId = appNavigation.urlPageId!;
    console.log("Loading page:", pageId);

    if (!server.connected) return;

    server
      .dispatch("readPage", { pageId })
      .then((result: any) => {
        console.log(result);
        setSyncStatus("up-to-date");
        setData(result?.page);
        setContent(result?.content || "");
        setLoaded(true);
      })
      .catch((err) => {
        console.error("Failed to load page:", err);
        setLoaded(true);
      });
  }, [appNavigation.urlPageId, server.connected]);

  const breadcrumbs = useMemo<TOCItem[]>(
    () => pageManager.buildBreadcrumbs(appNavigation.urlPageSlug!),
    [appNavigation.urlPageSlug]
  );


  async function deletePage(id: string) {
    await server.dispatch("deletePage", { pageId: id });
  }

  // Apply authoritative fields (title, slug, icon) from backend result into current page data
  // Inlined instead of separate helper to reduce indirection.

  // If active page slug changed, update URL (replace history entry).
  function adjustUrlIfSlugChanged(pageId: string, result: Page) {
    if (
      appNavigation.urlPageId === pageId &&
      result?.slug &&
      result.slug !== appNavigation.urlPageSlug
    ) {
      try {
        // if (result.url) appNavigation.navigate(result.url, { replace: true });
      } catch (e) {
        console.warn("Failed to adjust URL after backend slug update", e);
      }
    }
  }

  // Perform remote update (debounced)
  async function performUpdate(pageId: string, patch: any) {
    if (!server.connected) {
      setSyncStatus("error");
      return;
    }
    try {
      const result = await server.dispatch("updatePage", { pageId, ...patch });
      setData((prev: Page | undefined) => {
        if (!prev || prev.id !== pageId) return prev;
        const updated: Page = {
          ...prev,
          title: result.title,
          slug: result.slug,
          icon: result.icon,
        };
        return updated;
      });
      adjustUrlIfSlugChanged(pageId, result);
      setSyncStatus("up-to-date");
    } catch (e) {
      console.error("updatePage failed", e);
      setSyncStatus("error");
    }
  }

  const debouncedUpdate = useDebouncedCallback(
    (pageId: string, patch: any) => {
      setSyncStatus("pending");
      performUpdate(pageId, patch);
    },
    800,
    { maxWait: 2000 }
  );

  // Flush on unmount or page change
  function flushDebounce() {
    debouncedUpdate.flush();
  }

  function updateTitle(newTitle: string) {
    if (!data) return;
    // Only update title locally; wait for server response to adjust slug & URL.
    queuePatch(() => setData({ ...data, title: newTitle }), { title: newTitle });
  }

  function updateIcon(newIcon: string) {
    if (!data) return;
    queuePatch(() => setData({ ...data, icon: newIcon }), { icon: newIcon });
  }

  function updateContent(newContent: string) {
    setContent(newContent);
    if (!data) return; // no page id yet
    queuePatch(undefined, { content: newContent });
  }

  // Wrapper to avoid duplicating syncStatus + debounce logic
  function queuePatch(localApply: (() => void) | undefined, patch: any) {
    if (!data) return;
    if (localApply) localApply();
    setSyncStatus("pending"); // immediate visual feedback
    debouncedUpdate(data.id, patch);
  }

  // Slug updates are now authoritative from backend; we no longer compute them optimistically here.

  // If page id changes, flush queued updates first
  const lastPageIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (lastPageIdRef.current && lastPageIdRef.current !== appNavigation.urlPageId) {
      flushDebounce();
    }
    lastPageIdRef.current = appNavigation.urlPageId;
  }, [appNavigation.urlPageId, flushDebounce]);

  useEffect(() => {
    return () => {
      debouncedUpdate.flush();
    };
  }, [debouncedUpdate]);

  return (
    <PageContext.Provider
      value={{
        data,
        content,
        breadcrumbs,
        loaded,
        syncStatus,
        deletePage,
        updateTitle,
        updateIcon,
        updateContent,
      }}
    >
      {children}
    </PageContext.Provider>
  );
}

export function usePage() {
  const ctx = useContext(PageContext);
  if (!ctx)
    throw new Error("usePageContext must be used within a PageProvider");
  return ctx;
}
