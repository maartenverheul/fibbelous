import { Page, TOCItem } from "@/models";
import { createContext, useContext, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { usePageManager } from "./PageManagerContext";
import { IS_APP } from "@/checks";
import { useServer } from "./ServerContext";

export type TOCContextType = {
  toc: TOCItem[];
  loadTOC: (parent?: string) => Promise<void>;
};

const TOCContext = createContext<TOCContextType | undefined>(undefined);

export function TOCProvider({ children }: { children: React.ReactNode }) {
  const server = useServer();
  const pageManager = usePageManager();

  const [toc, setTOC] = useState<TOCItem[]>([]);

  useEffect(() => {
    if (!server.connected) return;
    console.log("Rebuilding TOC from pages", pageManager.pages);
    server.dispatch({
      type: "get_toc",
    });
    // setTOC(buildFullTOC(pageManager.pages));
  }, [server.status]);

  async function loadTOC(parent?: string) {
    if (!IS_APP) return;
    return invoke("load_toc", { parent })
      .then((newTOC) => {
        setTOC(newTOC as TOCItem[]);
      })
      .catch((error) => {
        console.error("Failed to load TOC:", error);
      });
  }

  function buildFullTOC(pages: Page[]): TOCItem[] {
    const toc: TOCItem[] = [];
    const pageMap = new Map<string, TOCItem>();

    // First, create all TOC items and map them by id
    pages.forEach((page) => {
      pageMap.set(page.id, {
        id: page.id,
        slug: page.slug,
        title: page.title,
        icon: page.icon,
        children: [],
      });
    });

    // Then, assign children to their parent TOC items
    pages.forEach((page) => {
      if (page.parentId) {
        const parentItem = pageMap.get(page.parentId);
        const currentItem = pageMap.get(page.id);
        if (parentItem && currentItem) {
          currentItem.children ??= [];
          parentItem.children!.push(currentItem);
        }
      }
    });

    // Finally, collect only root items (those without a parent)
    pages.forEach((page) => {
      if (!page.parentId) {
        const item = pageMap.get(page.id);
        if (item) {
          toc.push(item);
        }
      }
    });

    return toc;
  }

  return (
    <TOCContext.Provider
      value={{
        toc,
        loadTOC,
      }}
    >
      {children}
    </TOCContext.Provider>
  );
}

export function useTOCContext() {
  const ctx = useContext(TOCContext);
  if (!ctx) throw new Error("useTOCContext must be used within a TOCProvider");
  return ctx;
}
