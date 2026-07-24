import { SidebarProvider } from "../../context/SidebarContext";
import { cn } from "../../lib/utils";
import { MobileHeader } from "./MobileHeader";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { TabContent } from "./TabContent";

function AppShellLayout() {
  return (
    <div
      className={cn(
        "flex h-screen bg-app-bg text-stone-900",
        "dark:text-stone-100",
      )}
    >
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />
        <TabBar />
        <TabContent />
      </div>
    </div>
  );
}

export function AppShell() {
  return (
    <SidebarProvider>
      <AppShellLayout />
    </SidebarProvider>
  );
}
