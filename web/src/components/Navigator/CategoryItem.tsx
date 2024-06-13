import { cn } from "@/lib/utils";
import { PlusIcon } from "@radix-ui/react-icons";
import React, { useState } from "react";

type Props = {
  title: string;
  defaultOpen?: boolean;
  collapsable?: boolean;
  children: React.ReactNode;
  onOpenChange?(open: boolean): any;
  onCreatePage?(): any;
};

export function NavigatorCategoryItem({
  title,
  defaultOpen = true,
  collapsable = false,
  children,
  onOpenChange,
  onCreatePage,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  function toggleCollapse(value?: boolean) {
    if (!collapsable) return;
    const newValue = value != undefined ? value : !open;
    onOpenChange?.(newValue);
    setOpen(newValue);
  }

  function createSubPage() {
    onCreatePage?.();
    toggleCollapse(true);
  }

  return (
    <div className="NavigatorCategoryItem mb-4">
      <div className="flex items-center w-full gap-1 rounded-md group select-none h-[23px]">
        <p
          className={cn(
            "text-xs opacity-60 font-medium px-2 truncate mr-auto block w-full h-full",
            {
              "cursor-pointer": collapsable,
            }
          )}
          onClick={() => toggleCollapse()}
        >
          {title}
        </p>
        {onCreatePage && (
          <button
            className={cn(
              "bg-black cursor-pointer bg-opacity-0 hover:bg-opacity-5 rounded-md block h-full mr-1 p-1 opacity-0 group-hover:opacity-100"
            )}
            title="Create page"
            onClick={createSubPage}
          >
            <PlusIcon />
          </button>
        )}
      </div>
      {open && children}
    </div>
  );
}
