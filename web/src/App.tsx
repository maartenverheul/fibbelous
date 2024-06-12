import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Navigator from "./components/Navigator";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./components/ui/resizable";
import { trpc } from "./utils/trpc";
import PageEditorView from "./views/PageEditorView";
import { useEffect, useState } from "react";
import { createWSClient, wsLink } from "@trpc/client";
import { AppRouter } from "@fibbelous/server/trpc";
import PageEditorProvider from "./providers/PageEditorProvider";
import { PageEditorContext } from "./contexts/PageEditorContext";
import HomeView from "./views/HomeView";
import { Toaster } from "./components/ui/toaster";
import { useToast } from "./components/ui/use-toast";

const errors: Record<string, string> = {
  EPAGENOTFOUND: "Page not found.",
  EPAGELOCKED: "Page is in use.",
  _: "An unexpected error occurred.",
};

function App() {
  const { toast } = useToast();

  const [queryClient] = useState(() => new QueryClient());
  const [wsClient] = useState(() =>
    createWSClient({
      url: "ws://localhost:3001",
    })
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [wsLink<AppRouter>({ client: wsClient })],
    })
  );

  useEffect(() => {
    console.log("watch");
    wsClient.connection?.ws?.addEventListener("message", (event) => {
      // console.log("Message received", event);
      const d = JSON.parse(event.data);
      if (!d.error) return;
      const errorCode = d.error.message;
      const errorMessage = errors[errorCode] || errors["_"];
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    });
  }, []);

  return (
    <>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <PageEditorProvider>
            <PageEditorContext.Consumer>
              {(pageEditor) => (
                <>
                  <Toaster />
                  <div className="w-screen h-screen">
                    <ResizablePanelGroup direction="horizontal">
                      <ResizablePanel
                        minSize={10}
                        defaultSize={15}
                        maxSize={30}
                      >
                        <Navigator />
                      </ResizablePanel>
                      <ResizableHandle />
                      <ResizablePanel>
                        {pageEditor.openPage != undefined ? (
                          <PageEditorView />
                        ) : (
                          <HomeView />
                        )}
                      </ResizablePanel>
                    </ResizablePanelGroup>
                  </div>
                </>
              )}
            </PageEditorContext.Consumer>
          </PageEditorProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </>
  );
}

export default App;
