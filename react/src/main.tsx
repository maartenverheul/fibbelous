import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router";
import router from "./router";
import { WorkspaceProvider } from "./contexts/WorkspaceContext";
import { PageProvider } from "./contexts/PageContext";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <WorkspaceProvider>
    <PageProvider>
      <RouterProvider router={router} />
    </PageProvider>
  </WorkspaceProvider>
);
