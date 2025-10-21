import { TOCItem } from "@/models";
import TOCPageItem from "./TOCPageItem";
import { cn } from "@/lib/utils";
import { PlusIcon } from "lucide-react";
import { usePageManager } from "@/contexts/PageManagerContext";

type Props = {
  className?: string;
  onPageClick?(item: TOCItem): void;
  onNewPage?(parent?: string): void;
  onPageDelete?(id: string): void;
};

export default function TOC({ className }: Props) {
  const pageManager = usePageManager();
  const { toc: items } = usePageManager();

  return (
    <div className={cn("PageList p-2", className)}>
      {items.map((item) => (
        <TOCPageItem key={item.id} item={item} level={0} />
      ))}
      <button
        className="aspect-square block text-gray-600 ml-auto hover:bg-gray-700 rounded cursor-pointer hover:text-gray-500"
        onClick={() => pageManager.createPage(undefined, true)}
        title="Create new page"
      >
        <PlusIcon />
      </button>
    </div>
  );
}
