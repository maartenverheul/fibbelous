import { useTabs } from "../../context/TabContext";
import { cn } from "../../lib/utils";

export function TabBar() {
  const { tabs, activeTabId, activateTab, closeTab } = useTabs();

  if (tabs.length <= 1) return null;

  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-end gap-0.5 overflow-x-auto border-b border-zinc-200 bg-zinc-50 px-2",
        "dark:border-zinc-800 dark:bg-zinc-950",
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;

        return (
          <div
            key={tab.id}
            className={cn(
              "group flex max-w-48 shrink-0 items-center rounded-t-md border border-b-0 px-2 py-1 text-sm",
              isActive
                ? "border-zinc-200 bg-white font-medium text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                : "border-transparent bg-transparent text-zinc-500 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800/60",
            )}
          >
            <button
              type="button"
              onClick={() => activateTab(tab.id)}
              className="flex min-w-0 items-center gap-1 truncate"
            >
              {tab.icon && <span className="shrink-0">{tab.icon}</span>}
              <span className="truncate">{tab.label}</span>
            </button>
            <button
              type="button"
              onClick={() => closeTab(tab.id)}
              aria-label={`Close ${tab.label}`}
              className={cn(
                "ml-1.5 rounded px-1 text-xs leading-none opacity-0 transition-opacity group-hover:opacity-100",
                isActive && "opacity-100",
                "hover:bg-zinc-200 dark:hover:bg-zinc-800",
              )}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
