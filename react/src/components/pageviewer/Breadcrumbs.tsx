import { useAppNavigation } from "@/contexts/AppNavigationContext";
import { usePage } from "@/contexts/PageContext";
import { TOCItem } from "@/models";
import { ChevronRight } from "lucide-react";
import React from "react";

type Props = {
  items?: TOCItem[];
}

export default function Breadcrumbs({ items }: Props) {
  const appNavigation = useAppNavigation();
  const page = usePage();

  const MAX_ITEMS = 5; // show at most 5, counting from the end (current page backwards)
  const MAX_TITLE_CHARS = 28; // truncate individual breadcrumb titles

  const fullChain = items ?? page.breadcrumbs ?? [];
  const visibleChain = fullChain.length > MAX_ITEMS
    ? fullChain.slice(fullChain.length - MAX_ITEMS)
    : fullChain;
  const truncated = fullChain.length > visibleChain.length;
  const hiddenCount = fullChain.length - visibleChain.length;

  function shorten(title: string) {
    if (title.length <= MAX_TITLE_CHARS) return title;
    return title.slice(0, MAX_TITLE_CHARS - 1) + "…";
  }

  return (
    <div className="text-white flex items-center opacity-35 hover:opacity-100 transition-opacity delay-75 w-full overflow-hidden">
      {truncated && (
        <React.Fragment>
          <span
            className="px-1 py-0.5 rounded text-xs cursor-default select-none opacity-70 transition-colors"
            title={`${hiddenCount} hidden ancestor item${hiddenCount === 1 ? '' : 's'}`}
          >
            (+{hiddenCount})
          </span>
          <ChevronRight className="w-4 h-4 opacity-60" />
        </React.Fragment>
      )}
      {visibleChain.map((item, idx) => (
        <React.Fragment key={item.id}>
          <button
            className="cursor-pointer hover:bg-gray-700 p-1 pr-1.5 rounded text-sm max-w-[220px] truncate flex items-center"
            title={item.title}
            onClick={() => appNavigation.openTOCItem(item)}
          >
            <span className="mr-1 shrink-0">{item.icon}</span>
            <span className="truncate">{shorten(item.title)}</span>
          </button>
          {idx < visibleChain.length - 1 && (
            <ChevronRight className="w-4 h-4 opacity-60" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}