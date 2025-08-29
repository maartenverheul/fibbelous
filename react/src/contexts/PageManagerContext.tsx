import { Page, TOCItem } from "@/models";
import { createContext, useContext, useEffect, useState } from "react";
import { useWorkspaceContext } from "./WorkspaceContext";
import { invoke } from "@tauri-apps/api/tauri";
import { IS_APP } from "@/checks";

export type PageManagerContextType = {
  pages: Page[];
  loaded: boolean;
  load(id: string): Promise<Page | undefined>;
  createPage(parent?: string): Promise<Page | null>;
  deletePage(id: string): void;
  buildBreadcrumbs(pageId: string): TOCItem[];
};

const PageManagerContext = createContext<PageManagerContextType | undefined>(undefined);

export function PageManagerProvider({ children }: { children: React.ReactNode }) {
  const { selectedWorkspaceId } = useWorkspaceContext();
  const [pages, setPages] = useState<Page[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPages([
      {
        id: "1",
        title: "Test",
        icon: "1️⃣",
        createdAt: new Date().toISOString(),
      },
      {
        id: "2",
        parentId: "1",
        title: "Test 2",
        icon: "2️⃣",
        createdAt: new Date().toISOString(),
      },
      {
        id: "3",
        parentId: "2",
        title: "Test 3",
        icon: "3️⃣",
        createdAt: new Date().toISOString(),
      }
    ]);
    setLoaded(true);
  }, [selectedWorkspaceId]);

  async function createPage(parent?: string) {
    if (!IS_APP) return null;
    console.log("Creating new page at parent", parent);
    const page = (await invoke("create_new_page", { parent })) as Page;
    setPages((prev) => [...prev, page]);
    return page;
  }

  function deletePage(id: string) {
    console.log("Deleting page:", id);
    setPages((prev) => prev.filter((p) => p.id !== id));
  }

  async function load(id: string) {
    // TODO load from backend
    await new Promise((r) => setTimeout(r, 10));

    return pages.find((p) => p.id === id);
  }

  function buildBreadcrumbs(pageId: string): TOCItem[] {
    const breadcrumbs: TOCItem[] = [];
    let currentPage = pages.find((p) => p.id === pageId);
    while (currentPage) {
      breadcrumbs.unshift({
        id: currentPage.id,
        title: currentPage.title,
        icon: currentPage.icon,
      });
      currentPage = currentPage.parentId ? pages.find((p) => p.id === currentPage!.parentId) : undefined;
    }
    return breadcrumbs;
  }

  return <PageManagerContext.Provider value={{
    pages,
    loaded,
    load,
    createPage,
    deletePage,
    buildBreadcrumbs
  }}>
    {children}
  </PageManagerContext.Provider>;
}

export function usePageManager() {
  const ctx = useContext(PageManagerContext);
  if (!ctx)
    throw new Error("usePageManagerContext must be used within a PageManagerProvider");
  return ctx;
}
