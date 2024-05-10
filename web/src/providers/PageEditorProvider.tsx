import { PageEditorContext } from "@/contexts/PageEditorContext";
import { PropsWithChildren, useState } from "react";
import { Page } from "@fibbelous/server/models";
import { trpc } from "@/utils/trpc";
import { SyncStatus } from "@/types/sync";

export default function PageEditorProvider({ children }: PropsWithChildren) {
  const [openPage, setOpenPage] = useState<Page | undefined>();

  const [syncStatus] = useState<SyncStatus>("synced");

  const utils = trpc.useUtils();

  return (
    <PageEditorContext.Provider
      value={{
        openPage,
        syncStatus,
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
