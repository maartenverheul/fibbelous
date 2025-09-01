import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Outlet } from "react-router";
import Sidebar from "./components/sidebar/Sidebar";
import "./App.css";
import { useWorkspaceManager } from "./contexts/WorkspaceManagerContext";
import PageViewer from "./components/pageviewer/PageViewer";
import PageTabBar from "./components/tabs/PageTabBar";
import { AppNavigationProvider, useAppNavigation } from "./contexts/AppNavigationContext";
import { Tabs, TabsContent } from "@radix-ui/react-tabs";
import { PageProvider } from "./contexts/PageContext";
import { WorkspaceProvider } from "./contexts/WorkspaceContext";

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
        <div
          className="absolute inset-0 h-full w-full data-[state=inactive]:opacity-0 data-[state=inactive]:pointer-events-none"
        >
          <Outlet />
        </div>
      </div>
    </Tabs>
  );
}

function App() {
  const workspaceContext = useWorkspaceManager();

  return (
    <AppNavigationProvider>
      <WorkspaceProvider>
        <div className="w-screen h-screen bg-gray-950">
          {workspaceContext.list.length && (
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
        </div>
      </WorkspaceProvider>
    </AppNavigationProvider>
  );
}

export default App;
