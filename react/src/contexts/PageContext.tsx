import { Page, PageWithContent, TOCItem } from "@/models";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePageManager } from "./PageManagerContext";
import { useAppNavigation } from "./AppNavigationContext";
import { useWorkspace } from "./WorkspaceContext";
import { useServer } from "./ServerContext";

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
  children: React.ReactNode;
};

export function PageProvider({ children }: Props) {
  const appNavigation = useAppNavigation();
  const server = useServer();
  const pageManager = usePageManager();
  const [data, setData] = useState<Page>();
  const [loaded, setLoaded] = useState(false);
  const [content, setContent] = useState<string>("");

  useEffect(() => {
    const pageId = appNavigation.urlPageId!;
    console.log("Loading page:", pageId);

    if (!server.connected) return;

    server
      .dispatch({
        type: "read_page",
        payload: {
          pageId,
        },
      })
      .then((result: any) => {
        console.log(result);

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

  function updateContent(newContent: string) {}

  return (
    <PageContext.Provider
      value={{
        data,
        content,
        breadcrumbs,
        loaded,
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
