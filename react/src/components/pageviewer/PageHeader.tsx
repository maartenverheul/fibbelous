import { PlusIcon, RotateCcw, XCircle } from "lucide-react";
import PickableEmoji from "../PickableEmoji";
import { Page } from "@/models";

type PageHeaderProps = {
  page: Page;
  onChangeCover?(remove: boolean): Promise<any>;
  onTitleChange?(title: string): void;
  onIconChange?(icon: string): void;
};

export default function PageHeader({ page, onChangeCover, onTitleChange, onIconChange }: PageHeaderProps) {
  return (
    <div className="PageHeader">
      <div
        className="PageCover w-full bg-center bg-cover relative group"
        style={{
          backgroundImage: page.cover
            ? `url(${page.cover})`
            : undefined,
          height: page.cover ? "300px" : "100px",
        }}
      >
        {page.cover && (
          <div className="absolute bottom-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition delay-100">
            <button
              className="items-center gap-2 cursor-pointer select-none text-black/40 text-sm hover:bg-black/40 hover:text-white px-2 flex rounded"
              onClick={() => onChangeCover?.(true)}
            >
              <XCircle className="w-4" /> Remove
            </button>
            <button
              className="items-center gap-2 cursor-pointer select-none text-black/40 text-sm hover:bg-black/40 hover:text-white px-2 flex rounded"
              onClick={() => onChangeCover?.(false)}
            >
              <RotateCcw className="w-4" /> Change
            </button>
          </div>
        )}
      </div>
      <div className="PageHeader w-full max-w-[1000px] mx-auto p-4 relative pt-12">
        <div className="flex items-end gap-4 flex-row absolute left-0 top-0 -translate-y-1/2 group w-full">
          {page.icon && (
            <PickableEmoji onChange={(emoji) => onIconChange?.(emoji)}>
              <button className="Icon select-none w-24 h-24 text-7xl transition hover:bg-white/20 flex justify-center items-center cursor-pointer rounded">
                {page.icon}
              </button>
            </PickableEmoji>
          )}

          <button
            className="items-center gap-2 cursor-pointer select-none opacity-0 group-hover:opacity-100 text-white/40 text-sm hover:bg-white/20 hover:text-white px-2 flex rounded"
            onClick={() => onChangeCover?.(false)}
          >
            <PlusIcon className="w-4" /> Add cover
          </button>
        </div>

        <input
          type="text"
          className="text-white focus:outline-0 text-5xl font-bold placeholder:text-gray-600 w-full"
          placeholder="Untitled"
          value={page.title}
          onChange={(e) => onTitleChange?.(e.target.value)}
        />
      </div>
    </div>
  );
}
