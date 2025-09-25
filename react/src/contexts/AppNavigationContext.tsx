import { createContext, useContext, useEffect, useState } from "react";
import { LastVisited, Page, TOCItem, WorkspaceInfo } from "@/models";
import { useLocation, useNavigate, useParams } from "react-router";
import { useWorkspaceManager } from "./WorkspaceManagerContext";
import { SettingsTab } from "@/components/dialogs/settings/SettingsDialog";
import useLocalStorageState from "use-local-storage-state";

export type AppNavigationContextType = {
  urlWorkspaceSlug: string | undefined;
  urlPageSlug: string | undefined;
  urlPageId: string | undefined;
  tabs: TOCItem[];
  activeTabIndex?: number;
  hashParams: string[];
  openTOCItem(page: TOCItem, newTab?: boolean): boolean;
  toTOCITem(tree: Page[]): TOCItem;
  workspaceHomeLink(workspaceSlug?: string): string;
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
  const { workspaces, loaded, getWorkspaceBySlug, getWorkspace } = useWorkspaceManager();
  const { hash } = useLocation();

  const params = useParams();
  const { workspaceSlug } = params;
  const pageString = (() => {
    const parts = params["*"]?.split("/");
    return parts ? parts[parts.length - 1] : undefined;
  })();
  const workspaceId = getWorkspaceBySlug(workspaceSlug || "")?.info.id;
  const pageParts = pageString?.split("-");
  const urlPageId = pageParts?.[0];
  const urlPageSlug = (() => pageParts?.slice(1).join("-"))();

  const [activeTab, setActiveTab] = useState<number | undefined>();
  const [tabs, setTabs] = useState<TOCItem[]>([]);

  const [lastVisited, setLastVisited] = useLocalStorageState<LastVisited | undefined>("lastVisited", undefined);

  const hashParams = hash.startsWith("#") ? hash.slice(1).split("/").filter((h) => h.length > 0) : [];

  useEffect(() => {
    if (!loaded) return;

    (() => {
      // When no workspaces are loaded, navigate to the settings dialog
      if (workspaces.length == 0 && hashParams[0] != "settings")
        return navigate(settingsLink("workspaces"));

      // If no workspace is selected, navigate to the first workspace
      if (
        !workspaceSlug &&
        workspaces.length > 0 &&
        workspaces[0].info.slug != undefined
      ) {
        if (lastVisited) {
          const w = getWorkspace(lastVisited.workspaceId);
          if (lastVisited.itemId) {
            console.log("Navigating to last visited item", lastVisited.itemId, "in workspace", w?.info.slug);

            return navigate(pageLink([], w?.info.slug), { replace: true });
          }
          else {
            if (w) return navigate(workspaceHomeLink(w.info.slug), { replace: true });
          }
        }

        return navigate(settingsLink("workspaces"), { replace: true });
      }

      // If the selected workspace is invalid, redirect back
      if (
        workspaceSlug &&
        !workspaces.some((w) => w.info.slug === workspaceSlug)
      ) {
        // Invalid workspace, redirect to first valid workspace
        return navigate("/", { replace: true });
      }
    })();
  }, [loaded, workspaceSlug, workspaces, hash]);

  function openTOCItem(item: TOCItem, newTab: boolean = false) {
    if (!workspaceId) return false;
    const existingIndex = tabs.findIndex((tab) => tab.id === item.id);

    if (tabs.length == 0 || (newTab && existingIndex === -1)) {
      setTabs([...tabs, item]);
      setActiveTab(tabs.length);
    } else {
      // Change the current tab's page to the new page
      setTabs((prevTabs) =>
        prevTabs.map((tab, idx) => (idx === activeTab ? item : tab))
      );
      setActiveTab(activeTab);
    }

    setLastVisited({ workspaceId, itemId: item.id });
    navigate(item.url);
    return true;
  }

  function toTOCITem(tree: Page[]): TOCItem {
    const target = tree[tree.length - 1];
    const url = pageLink(tree);
    return { ...target, url, children: [] };
  }

  function pageLink(ancestors: Page[], _workspaceSlug?: string) {
    const base = `/${_workspaceSlug ?? workspaceSlug}`;
    const path = ancestors
      .map((p) => `${p.id}-${p.slug}`)
      .filter((s) => s.length > 0)
      .join("/");
    return `${base}/${path}`;
  }

  function workspaceHomeLink(_workspaceSlug: string | undefined = undefined) {
    const slug = _workspaceSlug ?? workspaceSlug;
    if (!slug) return "";
    return `/${slug}`;
  }

  function settingsLink(
    tab: string = "general",
    workspace: WorkspaceInfo | undefined = undefined
  ) {
    const prefix = workspaceHomeLink(workspace?.slug);
    const slug = workspace === null ? "" : workspace?.slug ?? workspaceSlug;
    const suffix = slug ? `/${slug}` : "";
    return `${prefix}/#settings/${tab}${suffix}`;
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
        urlPageSlug,
        urlPageId,
        tabs,
        activeTabIndex: activeTab,
        hashParams,
        openTOCItem,
        toTOCITem,
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
