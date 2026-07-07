import { Outlet } from "react-router-dom";
import { PageSaveProvider } from "../../context/PageSaveContext";
import { cn } from "../../lib/utils";
import { PageBreadcrumbs } from "./PageBreadcrumbs";

export function TabContent() {
  return (
    <PageSaveProvider>
      <main
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--app-surface)]",
        )}
      >
        <PageBreadcrumbs />
        <div className="page-editor-scroll min-h-0 flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </PageSaveProvider>
  );
}
