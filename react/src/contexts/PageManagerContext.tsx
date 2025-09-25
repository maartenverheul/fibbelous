import { Page, PageWithContent, TOCItem } from "@/models";
import { createContext, useContext, useState } from "react";
import { useServer } from "./ServerContext";
import { useAppNavigation } from "./AppNavigationContext";

export type PageManagerContextType = {
  pages: Page[];
  load(id: string): Promise<PageWithContent | undefined>;
  createPage(parent?: string, navigate?: boolean): Promise<Page | null>;
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
  const server = useServer();
  const appNavigation = useAppNavigation();
  const [pages, setPages] = useState<Page[]>([]);

  async function createPage(parent?: string, navigate?: boolean): Promise<Page> {
    console.debug("Creating new page at parent", parent);
    const result = await server.dispatch("createNewPage", {
      parent: parent,
    });

    const newList = [...pages, result];
    setPages(newList);
    if (navigate) {
      // Navigate to the new page
      const ancestors = getAncestors(result.id, newList);
      const tocItem = appNavigation.toTOCITem([...ancestors, result]);
      appNavigation.openTOCItem(tocItem, false);
    }
    return result;
  }

  function getAncestors(id: string, list?: Page[]): Page[] {
    list ??= pages;
    const ancestors: Page[] = [];
    let currentPage = list.find((p) => p.id === id);
    while (currentPage) {
      ancestors.unshift(currentPage);
      currentPage = currentPage.parentId
        ? list.find((p) => p.id === currentPage!.parentId)
        : undefined;
    }
    return ancestors;
  }

  async function deletePage(pageId: string) {
    await server.dispatch("deletePage", { pageId });
    setPages((prev) => prev.filter((p) => p.id !== pageId));
  }

  async function load(id: string): Promise<PageWithContent | undefined> {
    const page = (await server.dispatch("readPage", {
      pageId: id,
    })) as PageWithContent;
    return page;
  }

  function buildBreadcrumbs(pageId: string): TOCItem[] {
    // Build ancestor chain root..target
    const ancestors = getAncestors(pageId);
    if (ancestors.length === 0) return [];
    const wsSlug = appNavigation.urlWorkspaceSlug;
    const base = wsSlug ? `/${wsSlug}` : "";
    const pathSegments: string[] = [];
    return ancestors.map((p) => {
      pathSegments.push(`${p.id}-${p.slug}`);
      return {
        id: p.id,
        parentId: p.parentId,
        slug: p.slug,
        title: p.title,
        url: `${base}/${pathSegments.join('/')}`,
        icon: p.icon,
      } as TOCItem;
    });
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
