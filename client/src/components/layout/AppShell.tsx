import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { TabContent } from "./TabContent";
import { cn } from "../../lib/utils";

export function AppShell() {
  return (
    <div
      className={cn(
        "flex h-screen bg-white text-zinc-900",
        "dark:bg-zinc-950 dark:text-zinc-100",
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
