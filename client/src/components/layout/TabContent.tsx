import { Outlet } from "react-router-dom";
import { cn } from "../../lib/utils";
import { PageBreadcrumbs } from "./PageBreadcrumbs";

export function TabContent() {
  return (
    <main
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--app-surface)]",
      )}
    >
      <PageBreadcrumbs />
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-3xl p-4">
          <Outlet />
        </div>
      </div>
    </main>
  );
}
