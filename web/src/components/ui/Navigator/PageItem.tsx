import { cn } from "@/lib/utils";
import { PageMeta } from "@fibbelous/server/models";
import {
  ChevronRightIcon,
  DotsHorizontalIcon,
  PlusIcon,
} from "@radix-ui/react-icons";
import { useState } from "react";

type Props = {
  level: number;
  page: PageMeta;
  activeId?: string;
  onPageSelect?(page: PageMeta): any;
  onCreateSubPage?(parent: PageMeta): any;
};

export function NavigatorPageItem({
  page,
  level,
  activeId,
  onPageSelect,
  onCreateSubPage,
}: Props) {
  const [open, setOpen] = useState(false);

  const hasChildren = !!page.children?.length;

  function toggleCollapse(event: React.MouseEvent<Element>) {
    event.stopPropagation();
    setOpen(!open);
  }

  function createSubPage(event: React.MouseEvent<Element>) {
    event.stopPropagation();
    onCreateSubPage?.(page);
    setOpen(true);
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
            onClick={toggleCollapse}
            className={cn("transition-opacity opacity-100", {
              "group-hover:opacity-0": hasChildren,
            })}
          >
            {page.icon ?? "📄"}
          </span>
          <ChevronRightIcon
            onClick={toggleCollapse}
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
        <div
          className={cn(
            "bg-black bg-opacity-0 hover:bg-opacity-5 rounded-md block h-full p-1 opacity-0 group-hover:opacity-100"
          )}
          title="More options"
        >
          <DotsHorizontalIcon onClick={createSubPage} />
        </div>
        <div
          className={cn(
            "bg-black bg-opacity-0 hover:bg-opacity-5 rounded-md block h-full p-1 opacity-0 group-hover:opacity-100"
          )}
          title="Create page"
        >
          <PlusIcon onClick={createSubPage} />
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
            />
          ))}
        </ul>
      )}
    </li>
  );
}
