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
import { pageLabel, parsePageIdFromSegment } from "../lib/page/types";
import { registerPageNavigator } from "../lib/page/navigate";

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
  isTabOpen: (segment: string, pageId?: string | null) => boolean;
  closeTab: (tabId: string) => void;
  closeTabsForPages: (pageIds: string[]) => void;
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

function tabMatchesTarget(
  tab: Tab,
  segment: string,
  pageId: string | null,
) {
  return pageId != null ? tab.pageId === pageId : tab.segment === segment;
}

function resolvePageId(segment: string, pageId?: string | null) {
  return pageId ?? parsePageIdFromSegment(segment);
}

function tabNeedsUpdate(tab: Tab, segment: string, target: TabTarget) {
  return (
    tab.segment !== segment ||
    tab.label !== target.label ||
    tab.icon !== (target.icon ?? null) ||
    tab.pageId !== resolvePageId(segment, target.pageId)
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
        if (!tab.pageId) return tab;
        const page = findPageById(tab.pageId);
        if (!page) return tab;

        const label = pageLabel(page);
        const icon = page.icon ?? tab.icon;
        if (tab.label === label && tab.icon === icon) return tab;

        changed = true;
        return { ...tab, label, icon };
      });
      return changed ? next : prev;
    });
  }, [findPageById]);

  const navigateInTab = useCallback(
    (nextSegment: string, target: TabTarget) => {
      if (!slug) return;

      const pageId = resolvePageId(nextSegment, target.pageId);

      setTabs((prev) => {
        const existingTab = prev.find((tab) =>
          tabMatchesTarget(tab, nextSegment, pageId),
        );

        if (existingTab) {
          setActiveTabId(existingTab.id);
          navigate(buildWorkspacePath(slug, nextSegment));

          const needsUpdate =
            existingTab.segment !== nextSegment ||
            tabNeedsUpdate(existingTab, nextSegment, target);
          if (!needsUpdate) return prev;

          return prev.map((tab) =>
            tab.id === existingTab.id
              ? {
                  ...tab,
                  segment: nextSegment,
                  label: target.label,
                  icon: target.icon ?? null,
                  pageId,
                }
              : tab,
          );
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

      const pageId = resolvePageId(nextSegment, target.pageId);

      setTabs((prev) => {
        const existingTab = prev.find((tab) =>
          tabMatchesTarget(tab, nextSegment, pageId),
        );
        if (existingTab) {
          setActiveTabId(existingTab.id);
          navigate(buildWorkspacePath(slug, existingTab.segment));
          return prev;
        }

        const tab = createTab(nextSegment, target);
        setActiveTabId(tab.id);
        navigate(buildWorkspacePath(slug, nextSegment));
        return [...prev, tab];
      });
    },
    [navigate, slug],
  );

  const isTabOpen = useCallback(
    (nextSegment: string, pageId?: string | null) => {
      const id = resolvePageId(nextSegment, pageId);
      return tabs.some((tab) => tabMatchesTarget(tab, nextSegment, id));
    },
    [tabs],
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

  const closeTabsForPages = useCallback(
    (pageIds: string[]) => {
      if (pageIds.length === 0) return;

      const idSet = new Set(pageIds);
      setTabs((prev) => {
        const nextTabs = prev.filter(
          (tab) => !tab.pageId || !idSet.has(tab.pageId),
        );
        if (nextTabs.length === prev.length) return prev;
        if (nextTabs.length === 0) return prev;

        const activeIndex = prev.findIndex((tab) => tab.id === activeTabId);
        const closedActive =
          activeIndex !== -1 &&
          prev[activeIndex]?.pageId != null &&
          idSet.has(prev[activeIndex]!.pageId!);

        if (closedActive && slug) {
          const fallback = nextTabs[Math.min(activeIndex, nextTabs.length - 1)];
          setActiveTabId(fallback.id);
          navigate(buildWorkspacePath(slug, fallback.segment));
        }

        return nextTabs;
      });
    },
    [activeTabId, navigate, slug],
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

  useEffect(() => {
    registerPageNavigator(navigateInTab, findPageById);
    return () => registerPageNavigator(null, null);
  }, [navigateInTab, findPageById]);

  const value = useMemo(
    () => ({
      tabs,
      activeTabId,
      activeSegment: segment,
      navigateInTab,
      openTabInNew,
      isTabOpen,
      closeTab,
      closeTabsForPages,
      activateTab,
    }),
    [tabs, activeTabId, segment, navigateInTab, openTabInNew, isTabOpen, closeTab, closeTabsForPages, activateTab],
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
