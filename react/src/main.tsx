import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router";
import router from "./router";
import { WorkspaceManagerProvider } from "./contexts/WorkspaceManagerContext";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <WorkspaceManagerProvider>
    <RouterProvider router={router} />
  </WorkspaceManagerProvider>
);
