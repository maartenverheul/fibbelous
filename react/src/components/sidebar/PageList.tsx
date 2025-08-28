import { Page } from "@/models";
import PageItem from "./PageItem";
import { cn } from "@/lib/utils";
import { PlusIcon } from "lucide-react";

type Props = {
  className?: string;
  pages: Page[];
  onPageClick?(id: string): void;
  onNewPage?(parent?: string): void;
  onPageDelete?(id: string): void;
};

export default function PageList({
  pages,
  className,
  onPageClick,
  onPageDelete,
  onNewPage,
}: Props) {
  return (
    <div className={cn("PageList p-2", className)}>
      {onNewPage && (
        <button
          className="aspect-square block text-gray-600 ml-auto hover:bg-gray-700 rounded cursor-pointer hover:text-gray-500"
          onClick={() => onNewPage()}
        >
          <PlusIcon />
        </button>
      )}

      {pages.map((page) => (
        <PageItem
          key={page.id}
          page={page}
          onClick={onPageClick ? () => onPageClick?.(page.id) : undefined}
          onDelete={onPageDelete ? () => onPageDelete?.(page.id) : undefined}
          onNewPage={onNewPage ? () => onNewPage?.(page.id) : undefined}
        />
      ))}
    </div>
  );
}
