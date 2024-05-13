import { PageEditorContext } from "@/contexts/PageEditorContext";
import { PropsWithChildren, useState } from "react";
import { Page, PageMeta } from "@fibbelous/server/models";
import { trpc } from "@/utils/trpc";
import { SyncStatus } from "@/types/sync";
import { Change } from "textdiff-create";
import { useDebouncedCallback } from "use-debounce";
import create from "textdiff-create";
import patch from "textdiff-patch";
import { getStringHash } from "@/utils/hash";

export default function PageEditorProvider({ children }: PropsWithChildren) {
  const [openPage, setOpenPage] = useState<Page | undefined>();

  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");
  const [pendingChanges, setPendingChanges] = useState<Change[][]>([]);

  const [lastSyncedContent, setLastSyncedContent] = useState<
    string | undefined
  >();
  const [lastSyncedHash, setLastSyncedHash] = useState<string | undefined>();

  const updatePageMutation = trpc.updatePage.useMutation();
  const saveChangesMutation = trpc.saveChange.useMutation();

  const utils = trpc.useUtils();

  async function open(pageMeta: PageMeta) {
    console.debug("Opening page");
    const page = await utils.getPage.fetch({ id: pageMeta.id });
    const contentHash = await getStringHash(page.content);
    setOpenPage(page);
    setLastSyncedContent(page.content);
    setLastSyncedHash(contentHash);
  }

  function makeChange(change: Change[]) {
    console.log("Pending change..");

    setPendingChanges([...pendingChanges, change]);
    setSyncStatus("syncing");
    flushPendingChangesDebounced();
  }

  const flushPendingChangesDebounced = useDebouncedCallback(
    flushPendingChanges,
    100,
    {}
  );

  async function flushPendingChanges() {
    const { deltas, content } = applyChanges(
      lastSyncedContent!,
      pendingChanges
    );

    console.log("Save to server: ", deltas);
    try {
      await saveChangesMutation.mutateAsync({
        pageId: openPage!.id,
        change: deltas,
        originalHash: lastSyncedHash,
      });

      const newHash = await getStringHash(content);

      // Reset
      setPendingChanges([]);
      setLastSyncedContent(content);
      setLastSyncedHash(newHash);
      setSyncStatus("synced");
    } catch (e) {
      setSyncStatus("error");
    }
  }

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

  async function update(page: Partial<PageMeta>) {
    await updatePageMutation.mutateAsync(page);
  }

  return (
    <PageEditorContext.Provider
      value={{
        openPage,
        syncStatus,
        changes: pendingChanges,
        open,
        makeChange,
        update,
      }}
    >
      {children}
    </PageEditorContext.Provider>
  );
}
