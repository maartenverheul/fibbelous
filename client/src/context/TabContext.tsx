import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  buildWorkspacePath,
  getTabInfoFromSegment,
  parseWorkspacePath,
} from "../routes";
import { useWorkspacePages } from "../hooks/useWorkspacePages";
import { parsePageIdFromSegment } from "../types/page";

export type TabTarget = {
  label: string;
  icon?: string | null;
  pageId?: string | null;
};

export type Tab = {
  id: string;
  segment: string;
  label: string;
  icon: string | null;
  pageId: string | null;
};

type TabContextValue = {
  tabs: Tab[];
  activeTabId: string | null;
  activeSegment: string;
  navigateInTab: (segment: string, target: TabTarget) => void;
  openTabInNew: (segment: string, target: TabTarget) => void;
  closeTab: (tabId: string) => void;
  activateTab: (tabId: string) => void;
};

const TabContext = createContext<TabContextValue | null>(null);

function createTab(segment: string, target: TabTarget): Tab {
  return {
    id: crypto.randomUUID(),
    segment,
    label: target.label,
    icon: target.icon ?? null,
    pageId: target.pageId ?? parsePageIdFromSegment(segment),
  };
}

function createInitialState(segment: string) {
  const tabInfo = getTabInfoFromSegment(segment);
  if (!tabInfo) {
    return { tabs: [] as Tab[], activeTabId: null as string | null };
  }

  const tab = createTab(tabInfo.segment, {
    label: tabInfo.label,
    pageId: tabInfo.pageId ?? null,
  });
  return { tabs: [tab], activeTabId: tab.id };
}

function tabNeedsUpdate(tab: Tab, segment: string, target: TabTarget) {
  return (
    tab.segment !== segment ||
    tab.label !== target.label ||
    tab.icon !== (target.icon ?? null) ||
    tab.pageId !== (target.pageId ?? parsePageIdFromSegment(segment))
  );
}

export function TabProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams<{ slug: string }>();
  const { segment } = parseWorkspacePath(location.pathname);
  const { findPageById } = useWorkspacePages();

  const [tabs, setTabs] = useState<Tab[]>(
    () => createInitialState(segment).tabs,
  );
  const [activeTabId, setActiveTabId] = useState<string | null>(
    () => createInitialState(segment).activeTabId,
  );

  useEffect(() => {
    const tabInfo = getTabInfoFromSegment(segment);
    if (!tabInfo || !activeTabId || !slug) return;

    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== activeTabId) return tab;
        if (tab.segment === tabInfo.segment) return tab;
        return { ...tab, segment: tabInfo.segment };
      }),
    );
  }, [location.pathname, activeTabId, segment, slug]);

  useEffect(() => {
    setTabs((prev) => {
      let changed = false;
      const next = prev.map((tab) => {
        if (!tab.pageId || tab.icon) return tab;
        const page = findPageById(tab.pageId);
        if (!page?.icon) return tab;
        changed = true;
        return { ...tab, icon: page.icon };
      });
      return changed ? next : prev;
    });
  }, [findPageById]);

  const navigateInTab = useCallback(
    (nextSegment: string, target: TabTarget) => {
      if (!slug) return;

      const pageId = target.pageId ?? parsePageIdFromSegment(nextSegment);

      setTabs((prev) => {
        const existingTab = prev.find((tab) =>
          pageId != null ? tab.pageId === pageId : tab.segment === nextSegment,
        );

        if (existingTab) {
          setActiveTabId(existingTab.id);
          navigate(buildWorkspacePath(slug, existingTab.segment));
          return prev;
        }

        const nextTabFields = {
          segment: nextSegment,
          label: target.label,
          icon: target.icon ?? null,
          pageId,
        };

        navigate(buildWorkspacePath(slug, nextSegment));

        const activeId = activeTabId ?? prev[0]?.id;

        if (!activeId) {
          const tab = createTab(nextSegment, target);
          setActiveTabId(tab.id);
          return [tab];
        }

        if (!activeTabId) {
          setActiveTabId(activeId);
        }

        return prev.map((tab) =>
          tab.id === activeId && tabNeedsUpdate(tab, nextSegment, target)
            ? { ...tab, ...nextTabFields }
            : tab,
        );
      });
    },
    [activeTabId, navigate, slug],
  );

  const openTabInNew = useCallback(
    (nextSegment: string, target: TabTarget) => {
      if (!slug) return;

      const tab = createTab(nextSegment, target);
      setTabs((prev) => [...prev, tab]);
      setActiveTabId(tab.id);
      navigate(buildWorkspacePath(slug, nextSegment));
    },
    [navigate, slug],
  );

  const activateTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab || !slug) return;
      setActiveTabId(tabId);
      navigate(buildWorkspacePath(slug, tab.segment));
    },
    [tabs, navigate, slug],
  );

  const closeTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        if (prev.length <= 1) return prev;

        const index = prev.findIndex((tab) => tab.id === tabId);
        if (index === -1) return prev;

        const nextTabs = prev.filter((tab) => tab.id !== tabId);

        if (activeTabId === tabId && slug) {
          const fallback = nextTabs[Math.min(index, nextTabs.length - 1)];
          if (fallback) {
            setActiveTabId(fallback.id);
            navigate(buildWorkspacePath(slug, fallback.segment));
          }
        }

        return nextTabs;
      });
    },
    [activeTabId, navigate, slug],
  );

  const value = useMemo(
    () => ({
      tabs,
      activeTabId,
      activeSegment: segment,
      navigateInTab,
      openTabInNew,
      closeTab,
      activateTab,
    }),
    [tabs, activeTabId, segment, navigateInTab, openTabInNew, closeTab, activateTab],
  );

  return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
}

export function useTabs() {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error("useTabs must be used within TabProvider");
  }
  return context;
}
