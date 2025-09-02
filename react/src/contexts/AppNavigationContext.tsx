import { createContext, useContext, useEffect, useState } from "react";
import { TOCItem } from "@/models";
import { usePageManager } from "./PageManagerContext";
import { useLocation, useNavigate, useParams } from "react-router";
import { useWorkspaceManager } from "./WorkspaceManagerContext";

export type AppNavigationContextType = {
  urlWorkspaceSlug: string | undefined;
  urlPageSlug: string | undefined;
  tabs: TOCItem[];
  activeTabIndex?: number;
  openPage(pageId: string, newTab?: boolean): boolean;
  pageLink(pageId: string): string;
  openHome(): boolean;
  closeTab(index: number): boolean;
  changeTab(index: number): void;
};

const AppNavigationContext = createContext<
  AppNavigationContextType | undefined
>(undefined);

export function AppNavigationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const pageManager = usePageManager();
  const { list: workspaces, loaded } = useWorkspaceManager();
  const { hash } = useLocation();

  const params = useParams();
  const { workspaceSlug } = params;
  const pageSlug = params["*"];

  const [activeTab, setActiveTab] = useState<number | undefined>();
  const [tabs, setTabs] = useState<TOCItem[]>([]);

  useEffect(() => {
    if (!loaded) return;

    // When no workspaces are loaded, navigate to the settings dialog
    if (workspaces.length == 0 && !hash.startsWith("#settings"))
      navigate("/#settings/workspaces");

    // If no workspace is selected, navigate to the first workspace
    if (!workspaceSlug && workspaces.length > 0) {
      navigate(`/${workspaces[0].slug}`, { replace: true });
    }

    // If the selected workspace is invalid, redirect back
    if (workspaceSlug && !workspaces.some((w) => w.slug === workspaceSlug)) {
      // Invalid workspace, redirect to first valid workspace
      navigate("/", { replace: true });
    }
  }, [loaded, workspaceSlug, workspaces, hash]);

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
        prevTabs.map((tab, idx) => (idx === activeTab ? page : tab))
      );
      setActiveTab(activeTab);
    }

    navigateToPage(page.id);
    return true;
  }

  function pageLink(pageId: string) {
    return `/${workspaceSlug}/${pageId}`;
  }

  function openHome() {
    navigate(`/`);
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

  return (
    <AppNavigationContext.Provider
      value={{
        urlWorkspaceSlug: workspaceSlug,
        urlPageSlug: pageSlug,
        tabs,
        activeTabIndex: activeTab,
        openPage,
        pageLink,
        openHome,
        closeTab,
        changeTab,
      }}
    >
      {children}
    </AppNavigationContext.Provider>
  );
}

export function useAppNavigation() {
  const ctx = useContext(AppNavigationContext);
  if (!ctx)
    throw new Error(
      "useAppNavigation must be used within an AppNavigationProvider"
    );
  return ctx;
}
