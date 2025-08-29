import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router";
import router from "./router";
import { WorkspaceProvider } from "./contexts/WorkspaceContext";
import { PageProvider } from "./contexts/PageContext";
import { TOCProvider } from "./contexts/TOCContext";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <WorkspaceProvider>
    <PageProvider>
      <TOCProvider>
        <RouterProvider router={router} />
      </TOCProvider>
    </PageProvider>
  </WorkspaceProvider>
);
