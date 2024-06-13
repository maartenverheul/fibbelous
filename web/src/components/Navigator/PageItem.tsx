import { cn } from "@/lib/utils";
import { PageMeta } from "@fibbelous/server/models";
import {
  ChevronRightIcon,
  DotsHorizontalIcon,
  PlusIcon,
} from "@radix-ui/react-icons";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

type Props = {
  level: number;
  page: PageMeta;
  activeId?: string;
  onPageSelect?(page: PageMeta): any;
  onCreateSubPage?(parent: PageMeta): any;
  onPageFavourite?(page: PageMeta): any;
  onPageDelete?(page: PageMeta): any;
};

export function NavigatorPageItem({
  page,
  level,
  activeId,
  onPageSelect,
  onCreateSubPage,
  onPageFavourite,
  onPageDelete,
}: Props) {
  const [open, setOpen] = useState(false);

  const hasChildren = !!page.children?.length;

  function toggleCollapse() {
    setOpen(!open);
  }

  function createSubPage() {
    onCreateSubPage?.(page);
    setOpen(true);
  }

  function preventProp(fn: (...args: any) => any) {
    return (event: React.UIEvent<Element>) => {
      event.stopPropagation();
      fn();
    };
  }

  return (
    <li className="select-none">
      <button
        className={cn(
          "flex items-center bg-black bg-opacity-0 hover:bg-opacity-10 w-full p-1 gap-1 rounded-md group my-1",
          {
            "bg-opacity-5": activeId == page.id,
          }
        )}
        style={{ paddingLeft: level * 10 + 4 }}
        onClick={() => onPageSelect?.(page)}
      >
        <div
          className={cn(
            "bg-black bg-opacity-0 hover:bg-opacity-5 rounded-md relative"
          )}
        >
          <span
            onClick={preventProp(toggleCollapse)}
            className={cn("transition-opacity opacity-100", {
              "group-hover:opacity-0": hasChildren,
            })}
          >
            {page.icon ?? "📄"}
          </span>
          <ChevronRightIcon
            onClick={preventProp(toggleCollapse)}
            className={cn(
              "transition-all opacity-0 absolute top-[4px] left-[4px] w-[16px] h-[16px]",
              {
                "rotate-90": open,
                "group-hover:opacity-100": hasChildren,
                "pointer-events-none": !hasChildren,
              }
            )}
          />
        </div>
        <span className="text-sm truncate mr-auto">{page.title}</span>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <div
              className={cn(
                "bg-black bg-opacity-0 hover:bg-opacity-5 rounded-md block h-full p-1 opacity-0 group-hover:opacity-100"
              )}
              title="More options"
            >
              <DotsHorizontalIcon />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={preventProp(() => onPageFavourite?.(page))}
            >
              Add favourite
            </DropdownMenuItem>
            <DropdownMenuItem onClick={preventProp(() => onPageDelete?.(page))}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div
          className={cn(
            "bg-black bg-opacity-0 hover:bg-opacity-5 rounded-md block h-full p-1 opacity-0 group-hover:opacity-100"
          )}
          title="Create page"
          onClick={createSubPage}
        >
          <PlusIcon />
        </div>
      </button>
      {hasChildren && open && (
        <ul>
          {page.children!.map((child) => (
            <NavigatorPageItem
              key={child.id}
              page={child}
              level={level + 1}
              activeId={activeId}
              onPageSelect={onPageSelect}
              onCreateSubPage={onCreateSubPage}
              onPageDelete={onPageDelete}
              onPageFavourite={onPageFavourite}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
