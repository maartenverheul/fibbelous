import { Page, TOCItem } from "@/models";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useWorkspaceContext } from "./WorkspaceContext";
import { usePageManager } from "./PageManagerContext";

export type PageContextType = {
  data: Page | undefined;
  breadcrumbs: TOCItem[];
  loaded: boolean;
  content: string;
  deletePage: (id: string) => void;
  updateTitle: (newTitle: string) => void;
  updateIcon: (newIcon: string) => void;
  updateContent: (newContent: string) => void;
};

const PageContext = createContext<PageContextType | undefined>(undefined);

type Props = {
  pageId: string;
  children: React.ReactNode;
}

export function PageProvider({ pageId, children }: Props) {
  const { selectedWorkspaceId } = useWorkspaceContext();
  const pageManager = usePageManager();
  const [data, setData] = useState<Page>();
  const [loaded, setLoaded] = useState(false);
  const [content, setContent] = useState(`---
id: ${pageId}
---`);

  const breadcrumbs = useMemo<TOCItem[]>(() => pageManager.buildBreadcrumbs(pageId), [pageId]);

  useEffect(() => {
    console.debug("Loading page:", pageId);
    pageManager.load(pageId).then((page) => {
      setData(page);
      setLoaded(true);
    }).catch(err => {
      console.error("Failed to load page:", err);
      setLoaded(true);
    });
  }, [pageId]);

  function updatePage(page: Page) {
    console.warn("TODO Updating page:", page);
  }

  function deletePage(id: string) {
    console.warn("TODO Deleting page:", id);
  }

  function updateTitle(newTitle: string) {
    console.warn("TODO Updating title:", newTitle);
  }

  function updateIcon(newIcon: string) {
    console.warn("TODO Updating icon:", newIcon);
  }

  function updateContent(newContent: string) {

  }

  return <PageContext.Provider value={{
    data,
    content,
    breadcrumbs,
    loaded,
    deletePage,
    updateTitle,
    updateIcon,
    updateContent,
  }}>{children}</PageContext.Provider>;
}

export function usePage() {
  const ctx = useContext(PageContext);
  if (!ctx)
    throw new Error("usePageContext must be used within a PageProvider");
  return ctx;
}
