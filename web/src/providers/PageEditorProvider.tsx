import { PageEditorContext } from "@/contexts/PageEditorContext";
import { PropsWithChildren, useEffect, useState } from "react";
import { Page } from "@fibbelous/server/models";
import { trpc } from "@/utils/trpc";
import { SyncStatus } from "@/types/sync";
import { Change } from "textdiff-create";
import { useDebouncedCallback } from "use-debounce";
import create from "textdiff-create";
import patch from "textdiff-patch";

export default function PageEditorProvider({ children }: PropsWithChildren) {
  const [openPage, setOpenPage] = useState<Page | undefined>();

  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");
  const [changes, setChanges] = useState<Change[][]>([]);

  const [lastSyncedContent, setLastSyncedContent] = useState<
    string | undefined
  >();
  const [lastSyncedHash, setLastSyncedHash] = useState<string | undefined>(
    "none"
  );

  const saveChangesMutation = trpc.saveChange.useMutation();

  useEffect(() => {
    setLastSyncedContent(openPage?.content);
  }, [openPage]);

  const utils = trpc.useUtils();

  const sync = useDebouncedCallback(
    async () => {
      const { deltas, content } = applyChanges(lastSyncedContent!, changes);

      console.log("Save to server: ", deltas);
      try {
        await saveChangesMutation.mutateAsync({
          pageId: openPage!.id,
          change: deltas,
          originalHash: lastSyncedHash,
        });

        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const newHashBuffer = await crypto.subtle.digest("SHA-1", data);
        const newHash = [...new Uint8Array(newHashBuffer)]
          .map((t) => t.toString(16))
          .join("");

        // Reset
        setChanges([]);
        setLastSyncedContent(content);
        setLastSyncedHash(newHash);
        setSyncStatus("synced");
      } catch (e) {
        setSyncStatus("error");
      }
    },
    3000,
    {}
  );

  function applyChanges(
    original: string,
    changes: Change[][]
  ): { deltas: Change[]; content: string } {
    let current = original;
    for (const change of changes) {
      current = patch(current, change);
    }
    const mergedChanges = create(original, current);
    return { deltas: mergedChanges, content: current };
  }

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
        changes,
        makeChange(change) {
          console.log("Pending change..");

          setChanges([...changes, change]);
          setSyncStatus("syncing");
          sync();
        },
      }}
    >
      {children}
    </PageEditorContext.Provider>
  );
}
