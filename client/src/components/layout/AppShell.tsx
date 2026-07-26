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
        "flex h-dvh max-h-dvh min-h-0 w-full flex-1 overflow-hidden bg-app-bg text-stone-900",
        "dark:text-stone-100",
      )}
    >
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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
