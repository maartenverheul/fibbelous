import { EllipsisVertical, PlusIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Page } from "@/models";

type Props = {
  page: Page;
  onClick?(): void;
  onDelete?(): void;
  onNewPage?(): void;
}

export default function PageItem({ page, onClick, onDelete, onNewPage }: Props) {
  return (
    <div className="flex items-end justify-center hover:bg-slate-700 text-slate-400 gap-1 rounded relative group select-none text-sm">
      <div className="p-[2px]">
        <button className=" hover:bg-slate-500 cursor-pointer w-6 h-6 rounded flex items-center justify-center text-[16px]">{page.icon}</button>
      </div>
      <button onClick={onClick} className="text-left block w-full cursor-pointer h-[28px] relative">
        {page.title}
      </button>
      <div className="opacity-0 group-hover:opacity-100 flex p-[2px] rounded">
        {
          onNewPage && <button className="cursor-pointer hover:bg-slate-500 rounded flex items-center justify-center" onClick={onNewPage}><PlusIcon /></button>
        }
        <DropdownMenu>
          <DropdownMenuTrigger className="cursor-pointer hover:bg-slate-500 rounded flex items-center justify-center">
            <EllipsisVertical className="w-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={onDelete}>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}