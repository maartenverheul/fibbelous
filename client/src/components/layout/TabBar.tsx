import { useTabs } from "../../context/TabContext";
import { cn } from "../../lib/utils";
import { PiX } from "react-icons/pi";

export function TabBar() {
  const { tabs, activeTabId, activateTab, closeTab } = useTabs();

  if (tabs.length <= 1) return null;

  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-end gap-0.5 overflow-x-auto border-b border-[var(--app-border)] bg-[var(--app-panel)] px-2",
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
                ? "border-[var(--app-border)] bg-[var(--app-surface)] font-medium text-stone-900 dark:text-stone-50"
                : "border-transparent bg-transparent text-stone-600 hover:bg-stone-200/70 dark:text-stone-400 dark:hover:bg-stone-800/70",
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
                "hover:bg-stone-200/80 dark:hover:bg-stone-700",
              )}
            >
              <PiX className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
