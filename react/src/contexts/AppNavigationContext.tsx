import { createContext, useContext, useState } from "react";
import { TOCItem } from "@/models";
import { usePageManager } from "./PageManagerContext";
import { useNavigate } from "react-router";

export type AppNavigationContextType = {
  tabs: TOCItem[];
  activeTabIndex?: number;
  openPage(pageId: string, newTab?: boolean): boolean;
  closeTab(index: number): boolean;
  changeTab(index: number): void;
};

const AppNavigationContext = createContext<AppNavigationContextType | undefined>(undefined);

export function AppNavigationProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const pageManager = usePageManager();

  const [activeTab, setActiveTab] = useState<number | undefined>();
  const [tabs, setTabs] = useState<TOCItem[]>([]);

  function openPage(pageId: string, newTab: boolean = false) {
    const page = pageManager.pages.find((p) => p.id === pageId);

    if (!page) {
      console.warn("Trying to open unknown page in tab", pageId);
      return false;
    }

    const existingIndex = tabs.findIndex((tab) => tab.id === pageId);

    if (tabs.length == 0 || (newTab && existingIndex === -1)) {
      setTabs([...tabs, page]);
      setActiveTab(tabs.length);
    } else {
      // Change the current tab's page to the new page
      setTabs((prevTabs) =>
        prevTabs.map((tab, idx) =>
          idx === activeTab ? page : tab
        )
      );
      setActiveTab(activeTab);
    }

    navigateToPage(page.id);
    return true;
  }

  function navigateToPage(pageId: string) {
    navigate(`/workspace/page/${pageId}`);
  }

  function closeTab(index: number) {
    setTabs(tabs.filter((_, i) => i !== index));
    setActiveTab((prevActive) => {
      if (tabs.length === 1) return undefined;
      if (prevActive === undefined) return undefined;
      if (index < prevActive) return prevActive - 1;
      if (index === prevActive) {
        if (index < tabs.length - 1) return index;
        if (index > 0) return index - 1;
        return undefined;
      }
      return prevActive;
    });
    return true;
  }

  function changeTab(index: number) {
    setActiveTab(index);
  }

  return <AppNavigationContext.Provider value={{
    tabs,
    activeTabIndex: activeTab,
    openPage,
    closeTab,
    changeTab
  }}>{children}</AppNavigationContext.Provider>;
}

export function useAppNavigation() {
  const ctx = useContext(AppNavigationContext);
  if (!ctx)
    throw new Error("useAppNavigation must be used within an AppNavigationProvider");
  return ctx;
}
