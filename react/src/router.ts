import { createBrowserRouter, redirect } from "react-router";
import App from "./App";

const router = createBrowserRouter([
  {
    path: "/",
    Component: App,
  },
  {
    path: "test",
    Component: App,
  },
  {
    path: "*",
    loader: () => redirect("/"),
  },
]);

export default router;