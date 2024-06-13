import NavigatorPageTree from "./PageTree";
import { useEffect, useMemo, useState } from "react";
import arrayToTree from "array-to-tree";
import { trpc } from "@/utils/trpc";
import type {
  NavigatorChangeEvent,
  PageMeta,
  PageTree,
} from "@fibbelous/server/models";
import { usePageEditor } from "@/hooks";
import { useToast } from "../ui/use-toast";
import getErrorMessage from "@/i18n/errors";
import { NavigatorCategoryItem } from "./CategoryItem";

export default function Navigator() {
  const { toast } = useToast();

  const pagesQuery = trpc.pages.getAll.useQuery<PageMeta[]>();
  const createPageMutation = trpc.pages.create.useMutation();

  const pageEditor = usePageEditor();

  const [pages, setPages] = useState<PageMeta[]>([]);

  const deletePageMutation = trpc.pages.delete.useMutation();

  trpc.navigator.onChange.useSubscription(undefined, {
    onData(data: NavigatorChangeEvent) {
      let newList = [...pages];
      // Add new pages to the list
      if (data.added) {
        newList.push(...data.added);
      }
      // Update existing pages in the list
      if (data.updated) {
        for (const page of data.updated) {
          const index = newList.findIndex((p) => p.id === page.id);
          if (index == -1) continue; // Should not happen
          newList[index] = page;
        }
      }
      // Delete pages from the list
      if (data.deleted) {
        newList = newList.filter((page) => !data.deleted!.includes(page.id));
      }
      setPages(newList);
    },
  });

  const pageTree = useMemo<PageTree>(
    () =>
      // Convert list of pages to tree based and
      // based on the 'parent' property.
      arrayToTree(pages, {
        parentProperty: "parent",
        childrenProperty: "children",
      })
        // Don't display the pages that have a non-existing parent.
        // Should not happen unless tampered with.
        .filter((item) => item.parent == null),
    [pages]
  );

  useEffect(() => {
    setPages(pagesQuery.data ?? []);
  }, [pagesQuery.data]);

  function onPageSelect(page: PageMeta) {
    pageEditor.open(page.id);
  }

  async function createPage(parent?: PageMeta): Promise<PageMeta> {
    let newPage: PageMeta = {
      id: "",
      created: Date.now(),
      parent: parent?.id ?? null,
      title: "New page",
    };

    newPage = await createPageMutation.mutateAsync(newPage);
    pageEditor.open(newPage.id);
    return newPage;
  }

  async function deletePage(page: PageMeta) {
    await deletePageMutation.mutateAsync(page.id).catch((e) =>
      toast({
        title: "Error",
        description: getErrorMessage(e.message),
        variant: "destructive",
      })
    );
  }

  function favouritePage() {
    throw new Error("Not implemented");
  }

  return (
    <div className="Navigator bg-gray-100 h-full w-full p-2">
      <NavigatorCategoryItem title="Favorites" collapsable>
        <NavigatorPageTree
          pages={pageTree}
          activeId={pageEditor.openPage?.id}
          onPageSelect={onPageSelect}
          onCreateSubPage={createPage}
          onPageDelete={deletePage}
          onPageFavourite={favouritePage}
        />
      </NavigatorCategoryItem>
      <NavigatorCategoryItem
        title="Pages"
        collapsable
        onCreatePage={() => createPage()}
      >
        <NavigatorPageTree
          pages={pageTree}
          activeId={pageEditor.openPage?.id}
          onPageSelect={onPageSelect}
          onCreateSubPage={createPage}
          onPageDelete={deletePage}
          onPageFavourite={favouritePage}
        />
      </NavigatorCategoryItem>
    </div>
  );
}
