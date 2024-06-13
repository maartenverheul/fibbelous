import { PageMeta, PageTree } from "@fibbelous/server/models";
import { NavigatorPageItem } from "./PageItem";

type Props = {
  pages: PageTree;
  activeId?: string;
  onPageSelect?(page: PageMeta): any;
  onCreateSubPage?(parent: PageMeta): any;
  onPageFavoriteChange?(page: PageMeta, favorite: boolean): any;
  onPageDelete?(page: PageMeta): any;
};

export default function NavigatorPageTree({
  pages,
  activeId,
  onPageSelect,
  onCreateSubPage,
  onPageFavoriteChange,
  onPageDelete,
}: Props) {
  return (
    <div className="NavigatorPageTree">
      <ul>
        {pages.map((page) => (
          <NavigatorPageItem
            key={page.id}
            page={page}
            level={0}
            activeId={activeId}
            onPageSelect={onPageSelect}
            onCreateSubPage={onCreateSubPage}
            onPageDelete={onPageDelete}
            onPageFavoriteChange={onPageFavoriteChange}
          />
        ))}
      </ul>
    </div>
  );
}
