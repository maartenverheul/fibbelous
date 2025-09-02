import { createBrowserRouter, redirect } from "react-router";
import App from "../App";
import WorkspaceHome from "@/components/pageviewer/WorkspaceHome";
import WorkspaceGuard from "./WorkspaceGuard";
import PageViewer from "@/components/pageviewer/PageViewer";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { AppNavigationProvider } from "@/contexts/AppNavigationContext";
import { PageProvider } from "@/contexts/PageContext";

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <AppNavigationProvider>
        <WorkspaceProvider>
          <App />
        </WorkspaceProvider>
      </AppNavigationProvider>
    ),
    children: [
      {
        path: ":workspaceSlug",
        children: [
          {
            index: true,
            element: <WorkspaceHome />,
          },
          {
            path: "*",
            element: (
              <PageProvider>
                <PageViewer />
              </PageProvider>
            ), // Matches /:workspaceId/*
          },
        ],
      },
    ],
  },
  {
    path: "*",
    loader: () => redirect("/"),
  },
]);

export default router;
