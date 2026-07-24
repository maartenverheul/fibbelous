import { PiList } from "react-icons/pi";
import { useSidebar } from "../../context/SidebarContext";
import { useTabs } from "../../context/TabContext";
import { cn } from "../../lib/utils";
import { EmojiIcon } from "../emoji/EmojiIcon";

export function MobileHeader() {
  const { open } = useSidebar();
  const { tabs, activeTabId } = useTabs();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  return (
    <header
      className={cn(
        "flex h-11 shrink-0 items-center gap-2 border-b border-app-border bg-app-panel px-2 md:hidden",
      )}
    >
      <button
        type="button"
        onClick={open}
        aria-label="Open sidebar"
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-stone-700",
          "hover:bg-stone-200/80 dark:text-stone-300 dark:hover:bg-stone-800",
        )}
      >
        <PiList className="h-5 w-5" aria-hidden />
      </button>
      {activeTab && (
        <span className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-stone-900 dark:text-stone-50">
          {activeTab.icon && <EmojiIcon icon={activeTab.icon} size={16} />}
          <span className="truncate">{activeTab.label}</span>
        </span>
      )}
    </header>
  );
}
