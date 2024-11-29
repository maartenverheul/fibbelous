<script lang="ts">
  import server from "../server.svelte";

  function closePage() {
    server.state.activePage = null;
  }
</script>

<div class="PageEditor m-4">
  <p class="text-white mb-2">Status: {server.state.syncStatus}</p>
  <textarea
    disabled={server.state.activePage === null}
    bind:value={server.state.activePage}
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
</div>
