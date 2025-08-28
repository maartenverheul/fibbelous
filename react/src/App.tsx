import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Outlet } from "react-router";
import Sidebar from "./components/sidebar";
import "./App.css";
import { useWorkspaceContext } from "./contexts/WorkspaceContext";

function App() {
  const workspaces = useWorkspaceContext();

  return (
    <div className="w-screen h-screen bg-gray-950">
      {workspaces.workspaces.length && (
        <PanelGroup direction="horizontal" className="h-full">
          <Panel defaultSize={20} minSize={10} maxSize={40} className="h-full">
            <Sidebar />
          </Panel>
          <PanelResizeHandle className="bg-black w-[1px] cursor-col-resize" />
          <Panel defaultSize={80} minSize={40} className="h-full bg-slate-500">
            <p>Content</p>
          </Panel>
        </PanelGroup>
      )}

      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <Outlet />
      </div>
    </div>
  );
}

export default App;
