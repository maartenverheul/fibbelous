import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { TabContent } from "./TabContent";
import { cn } from "../../lib/utils";

export function AppShell() {
  return (
    <div
      className={cn(
        "flex h-screen bg-[var(--app-bg)] text-stone-900",
        "dark:text-stone-100",
      )}
    >
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TabBar />
        <TabContent />
      </div>
    </div>
  );
}
