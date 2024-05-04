import Navigator from "./components/ui/Navigator";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./components/ui/resizable";
import PageEditorView from "./views/PageEditorView";

function App() {
  return (
    <div className="w-screen h-screen">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel minSize={10} defaultSize={15} maxSize={30}>
          <Navigator />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel>
          <PageEditorView />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export default App;
