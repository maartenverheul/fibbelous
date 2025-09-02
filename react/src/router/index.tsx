import { createBrowserRouter, redirect } from "react-router";
import App from "../App";
import WorkspaceWildcard from "./WorkspaceWildcard";
import WorkspaceHome from "@/components/pageviewer/WorkspaceHome";
import WorkspaceGuard from "./WorkspaceGuard";

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <WorkspaceGuard>
        <App />
      </WorkspaceGuard>
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
            element: <WorkspaceWildcard />, // Matches /:workspaceId/*
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
