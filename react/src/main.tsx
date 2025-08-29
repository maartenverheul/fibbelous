import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router";
import router from "./router";
import { WorkspaceProvider } from "./contexts/WorkspaceContext";
import { TOCProvider } from "./contexts/TOCContext";
import { PageManagerProvider } from "./contexts/PageManagerContext";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <WorkspaceProvider>
    <PageManagerProvider>
      <TOCProvider>
        <RouterProvider router={router} />
      </TOCProvider>
    </PageManagerProvider>
  </WorkspaceProvider>
);
