import { ChevronRight, EllipsisVertical, PlusIcon } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TOCItem } from "@/models";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "../ui/collapsible";
import { usePageManager } from "@/contexts/PageManagerContext";
import { useAppNavigation } from "@/contexts/AppNavigationContext";
import { Link } from "react-router";

type Props = {
  item: TOCItem;
  level?: number;
};

export default function TOCPageItem({ item, level = 0 }: Props) {
  const pageManager = usePageManager();
  const appNavigation = useAppNavigation();

  const hasChildren = item.children && item.children.length > 0;
  const pageIndent = 8;

  // Controlled open state so we can auto-expand on new child creation.
  const [open, setOpen] = useState(false);

  async function handleCreateChild() {
    await pageManager.createPage(item.id, true);
    setOpen(true);
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} disabled={!hasChildren && !open}>
      <div className="TOCPageItem flex items-stretch justify-center transition duration-75 hover:bg-gray-700 text-gray-400 gap-1 rounded relative group/page select-none text-sm">
        <div
          className="p-[2px]"
          style={{
            paddingLeft: `${level * pageIndent + 2}px`,
          }}
        >
          <CollapsibleTrigger className="group/trigger hover:bg-gray-600 cursor-pointer w-6 h-6 rounded flex items-center justify-center text-[16px]">
            <span>{item.icon}</span>
            {hasChildren && (
              <ChevronRight className="absolute bg-gray-700 group-hover/trigger:bg-gray-600 opacity-0 group-hover/page:opacity-100 w-5 h-5 transition-transform duration-200 group-data-[state=open]/trigger:rotate-90" />
            )}
          </CollapsibleTrigger>
        </div>
        <Link
          to={item.url}
          onClick={() => appNavigation.openTOCItem(item)}
          className="text-left block w-full cursor-pointer relative align-middle pt-[4px]"
          draggable={false}
        >
          {item.title.length ? item.title : <span className="text-gray-600">Untitled</span>}
        </Link>
        <div className="opacity-0 group-hover/page:opacity-100 flex p-[2px] rounded">
          <button
            className="cursor-pointer hover:bg-gray-500 rounded flex items-center justify-center"
            onClick={handleCreateChild}
          >
            <PlusIcon />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger className="cursor-pointer hover:bg-gray-500 rounded flex items-center justify-center">
              <EllipsisVertical className="w-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => appNavigation.openTOCItem(item, true)}
              >
                Open in new tab
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => pageManager.deletePage(item.id)}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {hasChildren && (
        <CollapsibleContent>
          {item.children!.map((child) => (
            <TOCPageItem key={child.id} level={level + 1} item={child} />
          ))}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}
