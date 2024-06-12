import { PageEditorContext } from "@/contexts/PageEditorContext";
import { PropsWithChildren, useEffect, useState } from "react";
import { Page, PageMeta } from "@fibbelous/server/models";
import { trpc } from "@/utils/trpc";
import { SyncStatus } from "@/types/sync";
import { Change } from "textdiff-create";
import { useDebouncedCallback } from "use-debounce";
import create from "textdiff-create";
import patch from "textdiff-patch";
import { getStringHash } from "@/utils/hash";
import useLocalStorageState from "use-local-storage-state";

export default function PageEditorProvider({ children }: PropsWithChildren) {
  const [openPage, setOpenPage] = useState<Page | undefined>();

  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");
  const [pendingChanges, setPendingChanges] = useState<Change[][]>([]);

  //
  const [lastSyncedContent, setLastSyncedContent] = useState<
    string | undefined
  >();
  const [lastSyncedHash, setLastSyncedHash] = useState<string | undefined>();

  const [lastOpenedPage, setLastOpenedPage] = useLocalStorageState<
    string | undefined
  >("last-openend-page");

  const updatePageMutation = trpc.pages.update.useMutation();
  const saveChangesMutation = trpc.pages.saveChange.useMutation();
  const openPageMutation = trpc.pages.open.useMutation();

  // Open a page, fetch the content and set it as the last synced content.
  // If the page is already open, don't do anything.
  async function open(pageId: string) {
    // Don't open the same page
    if (pageId === openPage?.id) return;

    // Open the page
    console.debug("Opening page");
    const page: Page = await openPageMutation.mutateAsync({ id: pageId });
    const contentHash = await getStringHash(page.content);
    setOpenPage(page);
    setLastSyncedContent(page.content);
    setLastSyncedHash(contentHash);
    setLastOpenedPage(page.id);
  }

  // Make a change to the content
  function makeChange(change: Change[]) {
    console.log("Pending change..");

    setPendingChanges([...pendingChanges, change]);
    setSyncStatus("syncing");
    flushPendingChangesDebounced();
  }

  // Debounce the flushPendingChanges function
  const flushPendingChangesDebounced = useDebouncedCallback(
    flushPendingChanges,
    100,
    {}
  );

  // Flush the pending changes to the server
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

  // Apply changes to a string
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

  // Update the page meta
  async function update(page: Partial<PageMeta>) {
    await updatePageMutation.mutateAsync(page);
  }

  useEffect(() => {
    // Open the last opened page on mount
    if (lastOpenedPage != undefined) open(lastOpenedPage);
  }, []);

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
