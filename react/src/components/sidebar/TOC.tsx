import { TOCItem } from "@/models";
import TOCPageItem from "./TOCPageItem";
import { cn } from "@/lib/utils";
import { PlusIcon } from "lucide-react";

type Props = {
  className?: string;
  items: TOCItem[];
  onPageClick?(id: string): void;
  onNewPage?(parent?: string): void;
  onPageDelete?(id: string): void;
};

export default function TOC({
  items,
  className,
  onPageClick,
  onPageDelete,
  onNewPage,
}: Props) {
  return (
    <div className={cn("PageList p-2", className)}>
      {items.map((item) => (
        <TOCPageItem
          key={item.id}
          item={item}
          level={0}
          onClick={onPageClick ? () => onPageClick?.(item.id) : undefined}
          onDelete={onPageDelete ? () => onPageDelete?.(item.id) : undefined}
          onNewPage={onNewPage ? () => onNewPage?.(item.id) : undefined}
        />
      ))}
      {onNewPage && (
        <button
          className="aspect-square block text-gray-600 ml-auto hover:bg-gray-700 rounded cursor-pointer hover:text-gray-500"
          onClick={() => onNewPage()}
        >
          <PlusIcon />
        </button>
      )}
    </div>
  );
}
