import { cn } from "@/lib/utils";
import { TOCItem } from "@/models";
import { XIcon } from "lucide-react";
import { useAppNavigation } from "@/contexts/AppNavigationContext";
import type { MouseEvent } from "react";

type TabProps = {
  item: TOCItem;
  active?: boolean;
  onSelect(): void;
  onClose(): void;
}

function PageTab({ item, active, onClose, onSelect }: TabProps) {
  const handleAuxClick = (e: MouseEvent) => {
    // Middle mouse button closes the tab
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  return <button
    className={cn("flex items-center relative text-white group cursor-pointer rounded-t-lg pl-8 pr-10 py-1 transition-colors duration-75 hover:bg-gray-600 bg-white/5 border border-b-0 border-white/10", { "!bg-gray-500 !border-transparent": active })}
    onClick={onSelect}
    onAuxClick={handleAuxClick}
  >
    <span className="mr-4">{item.icon}</span>
    {item.title}
    <button
      className=" absolute right-1.5 top-1/2 p-[2px] -translate-y-1/2 hover:bg-white/20 transition-colors duration-75 rounded group-hover:opacity-100 opacity-0 cursor-pointer"
      onClick={onClose}
    >
      <XIcon className="opacity-60 hover:opacity-85 w-4 h-4" />
    </button>
  </button>;
}

type Props = {
  active?: number;
  tabs?: TOCItem[];
  className?: string;
}

export default function PageTabBar({ tabs, className }: Props) {

  const tabContext = useAppNavigation();

  // Only show if multiple tabs
  if (!tabs || tabs.length <= 1) return null;

  return <div className={cn("flex w-full h-min gap-2 pt-1 px-2 pb-0 bg-gray-800 border-b border-gray-700", className)}>
    {tabs.map((tab, i) => (
      <PageTab
        key={tab.id}
        item={tab}
        active={tabContext.activeTabIndex === i}
        onClose={() => tabContext.closeTab(i)}
        onSelect={() => tabContext.changeTab(i)}
      />
    ))}
  </div>
}