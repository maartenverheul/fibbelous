import NavigatorPageTree from "./PageTree";
import { useEffect, useMemo, useState } from "react";
import arrayToTree from "array-to-tree";
import { trpc } from "@/utils/trpc";
import type { PageMeta, PageTree } from "@fibbelous/server/models";
import { usePageEditor } from "@/hooks";

export default function Navigator() {
  const pagesQuery = trpc.getPages.useQuery<PageMeta[]>();
  const createPageMutation = trpc.createPage.useMutation();

  const pageEditor = usePageEditor();

  const [pages, setPages] = useState<PageMeta[]>([]);

  trpc.onPageAdd.useSubscription(undefined, {
    onData(data: PageMeta) {
      setPages([...pages, data]);
    },
  });

  const pageTree = useMemo<PageTree>(
    () =>
      arrayToTree(pages, {
        parentProperty: "parent",
        childrenProperty: "children",
      }),
    [pages]
  );

  useEffect(() => {
    setPages(pagesQuery.data ?? []);
  }, [pagesQuery.data]);

  function onPageSelect(page: PageMeta) {
    pageEditor.open(page);
  }

  async function createSubPage(parent: PageMeta): Promise<PageMeta> {
    let newPage: PageMeta = {
      id: "",
      created: Date.now(),
      parent: parent.id,
      title: "New page",
    };

    newPage = await createPageMutation.mutateAsync(newPage);
    pageEditor.open(newPage);
    return newPage;
  }

  return (
    <div className="Navigator bg-gray-100 h-full w-full">
      <NavigatorPageTree
        pages={pageTree}
        activeId={pageEditor.openPage?.id}
        onPageSelect={onPageSelect}
        onCreateSubPage={createSubPage}
      />
    </div>
  );
}
