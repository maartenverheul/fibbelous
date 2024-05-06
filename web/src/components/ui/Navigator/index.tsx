import { PageTree, PageMeta } from "@/types/pages";
import NavigatorPageTree from "./PageTree";
import { useEffect, useMemo, useState } from "react";
import arrayToTree from "array-to-tree";

export default function Navigator() {
  const [pages, setPages] = useState<PageMeta[]>([
    {
      id: "1",
      created: Date.now(),
      icon: "🤗",
      title: "Page 1",
      parent: null,
    },
    {
      id: "1.1",
      created: Date.now(),
      icon: "🤗",
      title: "Page 1.1",
      parent: "1",
    },
    {
      id: "1.1.1",
      created: Date.now(),
      icon: "🤗",
      title: "Page 1.1.1",
      parent: "1.1",
    },
    {
      id: "1.1.1.1",
      created: Date.now(),
      title: "Page 1.1.1.1mmmmmmmmmmmmmmmmmmmm",
      icon: "🤗",
      parent: "1.1.1",
    },
    {
      id: "1.2",
      created: Date.now(),
      title: "Page 1.2",
      parent: "1",
    },
    {
      id: "2",
      created: Date.now(),
      icon: "🤗",
      title: "Page 2",
      parent: null,
    },
    {
      id: "2.1",
      created: Date.now(),
      icon: "🤗",
      title: "Page 2.1",
      parent: "2",
    },
    {
      id: "2.1.1",
      created: Date.now(),
      icon: "🤗",
      title: "Page 2.1.1",
      parent: "2.1",
    },
    {
      id: "2.1.1.1",
      created: Date.now(),
      title: "Page 2.1.1.1mmmmmmmmmmmmmmmmmmmm",
      icon: "🤗",
      parent: "2.1.1",
    },
    {
      id: "2.2",
      created: Date.now(),
      title: "Page 2.2",
      parent: "2",
    },
  ]);

  const pageTree = useMemo<PageTree>(
    () =>
      arrayToTree(pages, {
        parentProperty: "parent",
        childrenProperty: "children",
      }),
    [pages]
  );

  useEffect(() => {
    console.log("update");
  }, [pages]);

  function createSubPage(parent: PageMeta) {
    console.log(parent);

    const newPage: PageMeta = {
      id: Math.round(Math.random() * 1000000).toString(16),
      created: Date.now(),
      parent: parent.id,
      title: "New page",
    };

    setPages([...pages, newPage]);
  }

  return (
    <div className="Navigator bg-gray-100 h-full w-full">
      <NavigatorPageTree pages={pageTree} onCreateSubPage={createSubPage} />
    </div>
  );
}
