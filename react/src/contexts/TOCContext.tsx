import { TOCItem } from "@/models";
import { createContext, useContext, useEffect, useState } from "react";
import { usePageManager } from "./PageManagerContext";
import { useServer } from "./ServerContext";
import { toast } from "sonner";

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
    loadTOC();
    // setTOC(buildFullTOC(pageManager.pages));
  }, [server.status]);

  async function loadTOC(parent?: string) {
    const result = (await server
      .dispatch({
        type: "get_toc",
        payload: { parent },
      })
      .catch((e) => {
        console.error("Failed to get TOC from server:", e);
        toast.error("Failed to get TOC from server");
      })) as any;

    setTOC(buildFullTOC(result.toc as TOCItem[]));
  }

  function buildFullTOC(items: TOCItem[]): TOCItem[] {
    const toc: TOCItem[] = [];
    const pageMap = new Map<string, TOCItem>();

    // First, create all TOC items and map them by id
    items.forEach((page) => {
      pageMap.set(page.id, {
        id: page.id,
        slug: page.slug,
        title: page.title,
        url: page.url,
        icon: page.icon,
        children: [],
      });
    });

    // Then, assign children to their parent TOC items
    items.forEach((page) => {
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
    items.forEach((page) => {
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
