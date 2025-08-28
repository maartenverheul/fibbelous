import { Page } from "@/models";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useWorkspaceContext } from "./WorkspaceContext";
import { invoke } from "@tauri-apps/api/tauri";

export type PageContextType = {
  pages: Page[];
  selectedPageId?: string;
  loaded: boolean;
  selectPage: (id: string) => void;
  createPage: (parent?: string) => Promise<Page>;
  updatePage: (page: Page) => void;
  deletePage: (id: string) => void;
};

const PageContext = createContext<PageContextType | undefined>(undefined);

export function PageProvider({ children }: { children: React.ReactNode }) {
  const { selectedWorkspaceId } = useWorkspaceContext();
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | undefined>(
    undefined
  );
  const [loaded, setLoaded] = useState(false);

  // Reset/load pages when workspace changes
  useEffect(() => {
    // TODO: Load pages for the selected workspace via Tauri once backend is ready
    setPages([]);
    setSelectedPageId(undefined);
    setLoaded(true);
  }, [selectedWorkspaceId]);

  function selectPage(id: string) {
    setSelectedPageId(id);
  };

  async function createPage(parent?: string) {
    console.log("Creating new page at parent", parent);
    const page = await invoke("create_new_page", { parent }) as Page;
    setPages((prev) => [...prev, page]);
    setSelectedPageId((prevSel) => prevSel ?? page.id);
    return page;
  };

  function updatePage(page: Page) {
    setPages((prev) => prev.map((p) => (p.id === page.id ? page : p)));
  };

  function deletePage(id: string) {
    setPages((prev) => prev.filter((p) => p.id !== id));
    setSelectedPageId((prevSel) => (prevSel === id ? undefined : prevSel));
  };

  const value = useMemo<PageContextType>(
    () => ({ pages, selectedPageId, loaded, selectPage, createPage: createPage, updatePage, deletePage }),
    [pages, selectedPageId, loaded]
  );

  return <PageContext.Provider value={value}>{children}</PageContext.Provider>;
}

export function usePageContext() {
  const ctx = useContext(PageContext);
  if (!ctx) throw new Error("usePageContext must be used within a PageProvider");
  return ctx;
}
