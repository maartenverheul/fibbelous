import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Page, TOCItem, WorkspaceInfo } from "@/models";
import { useLocation, useNavigate, useParams } from "react-router";
import { useWorkspaceManager } from "./WorkspaceManagerContext";
import { SettingsTab } from "@/components/dialogs/settings/SettingsDialog";

export type AppNavigationContextType = {
  urlWorkspaceSlug: string | undefined;
  urlPageSlug: string | undefined;
  urlPageId: string | undefined;
  tabs: TOCItem[];
  activeTabIndex?: number;
  hashParams: string[];
  openPage(page: Page, newTab?: boolean): boolean;
  pageLink(toc: TOCItem): string;
  workspaceHomeLink(workspace?: WorkspaceInfo): string;
  settingsLink(tab?: SettingsTab, workspace?: WorkspaceInfo | null): string;
  closeTab(index: number): boolean;
  changeTab(index: number): void;
  navigate: ReturnType<typeof useNavigate>;
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
  const { workspaces, loaded } = useWorkspaceManager();
  const { hash } = useLocation();

  const params = useParams();
  const { workspaceSlug } = params;
  const pageString = params["*"]?.split("/");
  const pageId = pageString?.[pageString.length - 1];
  const pageSlug = pageString?.[pageString.length - 2];

  const [activeTab, setActiveTab] = useState<number | undefined>();
  const [tabs, setTabs] = useState<TOCItem[]>([]);

  const hashParams = useMemo(() => {
    if (!hash.startsWith("#")) return [];
    return hash
      .slice(1)
      .split("/")
      .filter((h) => h.length > 0);
  }, [hash]);

  useEffect(() => {
    if (!loaded) return;

    // When no workspaces are loaded, navigate to the settings dialog
    if (workspaces.length == 0 && hashParams[0] != "settings")
      navigate(settingsLink("workspaces"));

    // If no workspace is selected, navigate to the first workspace
    if (
      !workspaceSlug &&
      workspaces.length > 0 &&
      workspaces[0].info.slug != undefined
    ) {
      // navigate(`/${workspaces[0].info.slug}`, { replace: true });
      navigate(settingsLink("workspaces"));
    }

    // If the selected workspace is invalid, redirect back
    if (
      workspaceSlug &&
      !workspaces.some((w) => w.info.slug === workspaceSlug)
    ) {
      // Invalid workspace, redirect to first valid workspace
      navigate("/", { replace: true });
    }
  }, [loaded, workspaceSlug, workspaces, hash]);

  function openPage(page: Page, newTab: boolean = false) {
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

    navigateToPage(page);
    return true;
  }

  function pageLink(toc: TOCItem) {
    return `/${workspaceSlug}/${toc.slug}/${toc.id}`;
  }

  function workspaceHomeLink(workspace: WorkspaceInfo | undefined = undefined) {
    const slug = workspace?.slug ?? workspaceSlug;
    if (!slug) return "";
    return `/${slug}`;
  }

  function settingsLink(
    tab: string = "general",
    workspace: WorkspaceInfo | undefined = undefined
  ) {
    const prefix = workspaceHomeLink(workspace);
    const slug = workspace === null ? "" : workspace?.slug ?? workspaceSlug;
    const suffix = slug ? `/${slug}` : "";
    return `${prefix}/#settings/${tab}${suffix}`;
  }

  function navigateToPage(page: TOCItem) {
    if (!workspaceSlug) return;
    navigate(`/${workspaceSlug}/${page.slug}/${page.id}`);
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
        urlPageId: pageId,
        tabs,
        activeTabIndex: activeTab,
        hashParams,
        openPage,
        pageLink,
        workspaceHomeLink,
        settingsLink,
        closeTab,
        changeTab,
        navigate,
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
