import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router";
import router from "./router";
import { WorkspaceProvider } from "./contexts/WorkspaceContext";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <WorkspaceProvider>
    <RouterProvider router={router} />
  </WorkspaceProvider>
);
