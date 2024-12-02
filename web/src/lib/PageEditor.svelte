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
    if (server.state.activePage != null) {
      content = server.state.activePage.content;
      lastSyncedContent = server.state.activePage.content;
    }
  });

  function oninput(event: Event) {
    delayedSync();
  }

  function sync() {
    if (!server.state.activePage?.id) return;
    const diff = create(lastSyncedContent, content);
    server.trpc.pages.edit.mutate({
      id: server.state.activePage.id,
      diff: diff,
    });
    lastSyncedContent = content;
  }

  function closePage() {
    server.state.activePage = null;
  }
</script>

<div class="PageEditor m-4">
  <p class="text-white mb-2">Status: {server.state.syncStatus}</p>
  <textarea
    disabled={server.state.activePage === null}
    bind:value={content}
    {oninput}
    class="border border-white disabled:border-slate-500 text-white w-full max-w-screen-md min-h-[300px]"
    placeholder="Empty page"
  ></textarea>
  <div class="flex gap-4">
    <button
      disabled={server.state.activePage === null}
      class="text-white bg-slate-500 rounded-md disabled:opacity-50 cursor-pointer px-3 py-1"
      onclick={closePage}>Close</button
    >
  </div>
  {server.state.activePage?.content}
  {content}
</div>
