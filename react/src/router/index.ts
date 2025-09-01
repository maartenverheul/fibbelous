import React from "react";
import { createBrowserRouter, redirect } from "react-router";
import WorkspaceRedirect from "@/router/WorkspaceRedirect";
import App from "../App";
import WorkspaceGuard from "@/router/WorkspaceGuard";
import WorkspaceWildcard from "./WorkspaceWildcard";
import WorkspaceHome from "@/components/pageviewer/WorkspaceHome";

const router = createBrowserRouter([
  {
    path: "/",
    Component: App,
    children: [
      {
        index: true,
        element: React.createElement(WorkspaceRedirect),
      },
      {
        path: ":workspaceId",
        Component: WorkspaceGuard,
        children: [
          {
            index: true,
            Component: WorkspaceHome,
          },
          {
            path: "*",
            Component: WorkspaceWildcard, // Matches /:workspaceId/*
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