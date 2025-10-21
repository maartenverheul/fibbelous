import { Page, PageWithContent, TOCItem } from "@/models";
import { createContext, useContext, useEffect, useState } from "react";
import { useServer } from "./ServerContext";
import { useAppNavigation } from "./AppNavigationContext";
import { useWorkspace } from "./WorkspaceContext";
import { toast } from "sonner";

export type PageManagerContextType = {
  load(id: string): Promise<PageWithContent | undefined>;
  createPage(parent?: string, navigate?: boolean): Promise<Page | null>;
  deletePage(id: string): void;
  buildBreadcrumbs(pageId: string): TOCItem[];

  toc: TOCItem[];
  loadTOC: (parent?: string) => Promise<TOCItem[]>;
  expanded: Set<string>;
  isExpanded: (id: string) => boolean;
  toggle: (id: string) => void;
  ensureVisible: (id: string) => void; // expand ancestor chain so page is visible
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

  const { urlPageId } = useAppNavigation();
  const workspace = useWorkspace();

  const [cached, setCached] = useState<TOCItem[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toc = buildFullTOC(cached);

  // When workspace changes, clear cached TOC & expansion state so we don't leak pages
  useEffect(() => {
    setCached([]);
    setExpanded(new Set());
  }, [workspace?.info?.id]);

  useEffect(() => {
    if (!server.connected) return;
    loadTOC().then((items) => {
      if (urlPageId) ensureVisible(urlPageId, items);
    });

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
  }, [server.connected, urlPageId]);


  function toTOCItem(tree: (Page | TOCItem)[]): TOCItem {
    const target = tree[tree.length - 1];
    const url = appNavigation.pageLink(tree);
    return { ...target, url, children: [] };
  }

  async function createPage(parent?: string, navigate?: boolean): Promise<Page> {
    console.debug("Creating new page at parent", parent);
    const result = await server.dispatch("createNewPage", {
      parent: parent,
    });

    const ancestors = getAncestors(result.id, cached);
    const tocItem = toTOCItem([...ancestors, result]);
    const newList = [...cached, tocItem];
    setCached(newList);
    if (navigate) {
      // Navigate to the new page
      appNavigation.openTOCItem(tocItem, false);
    }
    return result;
  }

  function getAncestors(id: string, list?: TOCItem[]): TOCItem[] {
    list ??= cached;
    const ancestors: TOCItem[] = [];
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
    setCached((prev) => prev.filter((p) => p.id !== pageId));
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

  /**
   * Load TOC items. If parent is undefined we (re)load the root + two levels.
   * If parent is provided, we merge the returned subtree (depth=2) into the existing cache
   * so previously loaded siblings & ancestors remain available.
   */
  async function loadTOC(parent?: string): Promise<TOCItem[]> {
    try {
      const res = await server.dispatch("getToc", { parent, depth: 2 });
      let merged: TOCItem[] = [];
      setCached((prev) => {
        merged = mergeTOC(prev, res.toc);
        return merged;
      });
      return merged;
    } catch (e) {
      console.error("Failed to get TOC from server:", e);
      toast.error("Failed to get TOC from server");
      return [];
    }
  }

  /**
   * Merge newItems into existing items (by id). We simply upsert all new items.
   * We do NOT delete missing items here to avoid accidental pruning when partial
   * subtrees are requested. Server side change events (tocUpdated) will handle removals.
   */
  function mergeTOC(existing: TOCItem[], newItems: TOCItem[]): TOCItem[] {
    if (!existing.length) return newItems.slice();
    const map = new Map<string, TOCItem>();
    for (const item of existing) map.set(item.id, item);
    for (const item of newItems) map.set(item.id, item); // upsert
    return Array.from(map.values());
  }

  function buildFullTOC(items: TOCItem[]): TOCItem[] {
    // console.debug("Building full TOC from items:", items);
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
        // children will be assigned only if we actually link some below; this allows us
        // to distinguish between "not yet loaded" (undefined) vs "loaded but no children" (empty array)
        children: undefined,
      });
    });

    // Then, assign children to their parent TOC items
    items.forEach((page) => {
      if (page.parentId) {
        const parentItem = pageMap.get(page.parentId);
        const currentItem = pageMap.get(page.id);
        if (parentItem && currentItem) {
          parentItem.children ??= [];
          parentItem.children.push(currentItem);
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

  function isExpanded(id: string) { return expanded.has(id); }
  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function ensureVisible(targetId: string, source?: TOCItem[]) {
    const list = source ?? cached;
    if (!list.length) return;
    const idToItem = new Map(list.map(i => [i.id, i] as const));
    const chain: string[] = [];
    let current = idToItem.get(targetId);
    while (current) {
      chain.push(current.id); // target .. root
      current = current.parentId ? idToItem.get(current.parentId) : undefined;
    }
    if (chain.length === 0) return;
    chain.reverse(); // root .. target
    // Expand all ancestors (exclude leaf itself)
    const ancestors = chain.slice(0, chain.length - 1);
    setExpanded(prev => {
      const next = new Set(prev);
      for (const id of ancestors) next.add(id);
      return next;
    });
  }

  return (
    <PageManagerContext.Provider
      value={{
        load,
        createPage,
        deletePage,
        buildBreadcrumbs,

        toc,
        loadTOC,
        expanded,
        isExpanded,
        toggle,
        ensureVisible,
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
