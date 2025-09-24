import { useAppNavigation } from "@/contexts/AppNavigationContext";
import { usePage } from "@/contexts/PageContext";
import { TOCItem } from "@/models"
import { ChevronRight } from "lucide-react";
import React from "react";

type Props = {
  items?: TOCItem[];
}

export default function Breadcrumbs({ items }: Props) {
  const appNavigation = useAppNavigation();
  const page = usePage();

  return (
    <div className="text-white flex items-center opacity-35 hover:opacity-100 transition-opacity delay-75 w-full">
      {(items ?? page.breadcrumbs).map(item => (
        <React.Fragment key={item.id}>
          <button className="cursor-pointer hover:bg-gray-700 p-1 pr-1.5 rounded text-sm" onClick={() => appNavigation.openPage(item)}>
            <span className="mr-1">{item.icon}</span>
            {item.title}
          </button>
          <ChevronRight className="w-4 h-4 opacity-60 last:hidden" />
        </React.Fragment>
      ))}
    </div>
  );
}