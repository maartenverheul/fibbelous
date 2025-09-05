import { Page, PageWithContent, TOCItem } from "@/models";
import { createContext, useContext, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { IS_APP } from "@/checks";
import { useWorkspace } from "./WorkspaceContext";

export type PageManagerContextType = {
  pages: Page[]
  load(id: string): Promise<PageWithContent | undefined>;
  createPage(parent?: string): Promise<Page | null>;
  deletePage(id: string): void;
  buildBreadcrumbs(pageId: string): TOCItem[];
};

const PageManagerContext = createContext<PageManagerContextType | undefined>(
  undefined
);

export function PageManagerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspace = useWorkspace();
  const [pages, setPages] = useState<Page[]>([]);

  async function createPage(parent?: string) {
    console.log("Creating new page at parent", parent);
    const page = (await invoke("create_new_page", { parent })) as Page;
    setPages((prev) => [...prev, page]);
    return page;
  }

  function deletePage(id: string) {
    console.log("Deleting page:", id);
    setPages((prev) => prev.filter((p) => p.id !== id));
  }

  async function load(id: string): Promise<PageWithContent | undefined> {
    const page = (await invoke("read_page", {
      workspace_id: workspace?.info?.id,
      page_id: id,
    })) as PageWithContent;
    return page;
  }

  function buildBreadcrumbs(pageId: string): TOCItem[] {
    const breadcrumbs: TOCItem[] = [];
    let currentPage = pages.find((p) => p.id === pageId);
    while (currentPage) {
      breadcrumbs.unshift({
        id: currentPage.id,
        slug: currentPage.slug,
        title: currentPage.title,
        icon: currentPage.icon,
      });
      currentPage = currentPage.parentId
        ? pages.find((p) => p.id === currentPage!.parentId)
        : undefined;
    }
    return breadcrumbs;
  }

  return (
    <PageManagerContext.Provider
      value={{
        pages,
        load,
        createPage,
        deletePage,
        buildBreadcrumbs,
      }}
    >
      {children}
    </PageManagerContext.Provider>
  );
}

export function usePageManager() {
  const ctx = useContext(PageManagerContext);
  if (!ctx)
    throw new Error(
      "usePageManagerContext must be used within a PageManagerProvider"
    );
  return ctx;
}
