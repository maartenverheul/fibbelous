import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Outlet } from "react-router";
import Sidebar from "./components/sidebar/Sidebar";
import "./App.css";
import { useWorkspaceContext } from "./contexts/WorkspaceContext";
import PageViewer from "./components/pageviewer/PageViewer";
import PageTabBar from "./components/tabs/PageTabBar";
import { AppNavigationProvider, useAppNavigation } from "./contexts/AppNavigationContext";
import { Tabs, TabsContent } from "@radix-ui/react-tabs";
import { PageProvider } from "./contexts/PageContext";

function TabsShell() {
  const tabsContext = useAppNavigation();

  return (
    <Tabs
      value={tabsContext.activeTabIndex?.toString()}
      onValueChange={(v) => tabsContext.changeTab(parseInt(v))}
      defaultValue={tabsContext.tabs[0]?.id}
      className="w-full h-full flex flex-col relative"
    >
      <PageTabBar
        tabs={tabsContext.tabs}
        active={tabsContext.activeTabIndex}
        className="relative"
      />
      <div className="relative flex-1">
        {tabsContext.tabs.map((tab, i) => {
          return (
            <TabsContent
              key={i}
              value={i.toString()}
              forceMount
              className="absolute inset-0 h-full w-full data-[state=inactive]:opacity-0 data-[state=inactive]:pointer-events-none"
            >
              <PageProvider pageId={tab.id}>
                <PageViewer />
              </PageProvider>
            </TabsContent>
          );
        })}
      </div>
    </Tabs>
  );
}

function App() {
  const workspaceContext = useWorkspaceContext();

  return (
    <AppNavigationProvider>
      <div className="w-screen h-screen bg-gray-950">
        {workspaceContext.workspaces.length && (
          <PanelGroup direction="horizontal" className="h-full">
            <Panel defaultSize={20} minSize={10} maxSize={40} className="h-full">
              <Sidebar />
            </Panel>
            <PanelResizeHandle className="bg-black w-[1px] cursor-col-resize" />
            <Panel defaultSize={80} minSize={40} className="h-full bg-gray-500 flex flex-col">
              <TabsShell />
            </Panel>
          </PanelGroup>
        )}

        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <Outlet />
        </div>
      </div>
    </AppNavigationProvider>
  );
}

export default App;
