import React from "react";
import { createBrowserRouter, redirect } from "react-router";
import WorkspaceRedirect from "@/router/WorkspaceRedirect";
import App from "../App";
import SettingsDialogRoute from "./SettingsDialogRoute";
import WorkspaceGuard from "@/router/WorkspaceGuard";
import { Outlet } from "react-router";

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
        path: "settings/:tab?",
        Component: SettingsDialogRoute,
      },
      {
        path: ":workspaceId",
        element: React.createElement(WorkspaceGuard, {
          children: React.createElement(Outlet),
        }),
      },
    ],
  },
  {
    path: "*",
    loader: () => redirect("/"),
  },
]);

export default router;