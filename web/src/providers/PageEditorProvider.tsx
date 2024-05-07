import { PageEditorContext } from "@/contexts/PageEditorContext";
import { PropsWithChildren, useState } from "react";
import { Page } from "@fibbelous/server/models";
import { trpc } from "@/utils/trpc";

export default function PageEditorProvider({ children }: PropsWithChildren) {
  const [openPage, setOpenPage] = useState<Page | undefined>();

  const utils = trpc.useUtils();

  return (
    <PageEditorContext.Provider
      value={{
        openPage,
        async open(pageMeta) {
          console.debug("Opening page");
          return utils.getPage
            .fetch({ id: pageMeta.id })
            .then((page: Page) => setOpenPage(page));
        },
      }}
    >
      {children}
    </PageEditorContext.Provider>
  );
}
