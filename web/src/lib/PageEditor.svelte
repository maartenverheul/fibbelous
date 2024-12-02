<script lang="ts">
  import server from "../server.svelte";
  import create from "textdiff-create";
  import { debounce } from "throttle-debounce";

  let lastSyncedContent = "";
  let content = $state("");

  const delayedSync = debounce(1000, sync, {
    atBegin: false,
  });

  $effect(() => {
    if (server.activePage != null) {
      content = server.activePage.content;
      lastSyncedContent = server.activePage.content;
    }
  });

  function oninput(event: Event) {
    delayedSync();
  }

  function sync() {
    if (!server.activePage?.id) return;
    const diff = create(lastSyncedContent, content);
    server.trpc!.workspace.pages.edit.mutate({
      id: server.activePage.id,
      diff: diff,
    });
    lastSyncedContent = content;
  }

  function closePage() {
    server.activePage = null;
  }
</script>

<div class="PageEditor m-4">
  <p class="text-white mb-2">Status: {server.syncStatus}</p>
  <textarea
    disabled={server.activePage === null}
    bind:value={content}
    {oninput}
    class="border border-white disabled:border-slate-500 text-white w-full max-w-screen-md min-h-[300px]"
    placeholder="Empty page"
  ></textarea>
  <div class="flex gap-4">
    <button
      disabled={server.activePage === null}
      class="text-white bg-slate-500 rounded-md disabled:opacity-50 cursor-pointer px-3 py-1"
      onclick={closePage}>Close</button
    >
  </div>
  {server.activePage?.content}
  {content}
</div>
