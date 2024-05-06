import { PageMeta, PageTree } from "@/types/pages";
import { NavigatorPageItem } from "./PageItem";

type Props = {
  pages: PageTree;
  onCreateSubPage?(parent: PageMeta): any;
};

export default function NavigatorPageTree({ pages, onCreateSubPage }: Props) {
  return (
    <div className="NavigatorPageTree p-2">
      <ul>
        {pages.map((page) => (
          <NavigatorPageItem
            page={page}
            level={0}
            onCreateSubPage={(parent) => onCreateSubPage?.(parent ?? page)}
          />
        ))}
      </ul>
    </div>
  );
}
