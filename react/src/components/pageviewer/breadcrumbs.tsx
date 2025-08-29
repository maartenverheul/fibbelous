import { TOCItem } from "@/models"
import { ChevronRight } from "lucide-react";

type Props = {
  items: TOCItem[];
}

export default function Breadcrumbs({ items }: Props) {
  return (
    <div className="text-white flex items-center opacity-35 hover:opacity-100 transition-colors w-full">
      {items.map(item => (
        <>
          <button key={item.id} className="cursor-pointer hover:bg-gray-700 p-1 rounded text-sm">
            <span className="mr-1">{item.icon}</span>
            {item.title}
          </button>
          <ChevronRight className="w-4 h-4 opacity-60 last:hidden" />
        </>
      ))}
    </div>
  );
}