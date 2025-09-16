import { TOCItem } from "@/models";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useServer } from "./ServerContext";
import { toast } from "sonner";

export type TOCContextType = {
  toc: TOCItem[];
  loadTOC: (parent?: string) => Promise<void>;
};

const TOCContext = createContext<TOCContextType | undefined>(undefined);

export function TOCProvider({ children }: { children: React.ReactNode }) {
  const server = useServer();

  const [cached, setCached] = useState<TOCItem[]>([]);
  const toc = useMemo(() => buildFullTOC(cached), [cached]);

  useEffect(() => {
    if (!server.connected) return;
    loadTOC();

    const unsubscribe = server.subscribe("tocUpdated", (data) => {
      if (data.action === "add") setCached((prev) => [...prev, data.item!]);
      if (data.action === "remove")
        setCached((prev) => prev.filter((i) => i.id !== data.id));
      if (data.action === "update")
        setCached((prev) =>
          prev.map((i) => (i.id === data.id ? data.item! : i))
        );
    });
    return () => {
      unsubscribe();
    };
  }, [server.connected]);

  async function loadTOC(parent?: string) {
    return await server
      .dispatch("getToc", { parent })
      .then((res) => setCached(res.toc))
      .catch((e) => {
        console.error("Failed to get TOC from server:", e);
        toast.error("Failed to get TOC from server");
      });
  }

  function buildFullTOC(items: TOCItem[]): TOCItem[] {
    console.debug("Building full TOC from items:", items);
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
