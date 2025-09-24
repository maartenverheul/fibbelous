import { Page, TOCItem } from "@/models";
import { createContext, useContext, useEffect, useMemo, useState, useRef, useCallback } from "react";
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

  const debouncedUpdate = useDebouncedCallback(
    (pageId: string, patch: any) => {
      setSyncStatus("pending");
      if (!server.connected) {
        setSyncStatus("error");
        return;
      }
      server
        .dispatch("updatePage", { pageId, ...patch })
        .then(() => setSyncStatus("up-to-date"))
        .catch((e) => {
          console.error("updatePage failed", e);
          setSyncStatus("error");
        });
    },
    800, // debounce window (ms)
    { maxWait: 2000 }
  );

  // Flush on unmount or page change
  const flushDebounce = useCallback(() => {
    debouncedUpdate.flush();
  }, [debouncedUpdate]);

  function updateTitle(newTitle: string) {
    if (!data) return;
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

  // If page id changes, flush queued updates first
  const lastPageIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (lastPageIdRef.current && lastPageIdRef.current !== appNavigation.urlPageId) {
      flushDebounce();
    }
    lastPageIdRef.current = appNavigation.urlPageId;
  }, [appNavigation.urlPageId, flushDebounce]);

  useEffect(() => flushDebounce, [flushDebounce]);

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
