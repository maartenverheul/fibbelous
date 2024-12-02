<script lang="ts">
  import server from "../server.svelte";
  import workspaceStore from "../workspace.svelte";

  let selectedPageId: string | null = $state(null);

  function selectPage(id: string) {
    selectedPageId = id;
  }

  function newPage() {
    const pageName = prompt("Enter page name") || undefined;
    server.currentServer!.trpc.workspace.pages.create.query({
      title: pageName,
    });
  }

  function deleteSelectedPage() {
    if (!selectedPageId) return;
    server.currentServer!.trpc.workspace.pages.delete.query(selectedPageId);
  }

  async function loadPage(id: string) {
    if (!id) return;
    server.activePage =
      await server.currentServer!.trpc.workspace.pages.load.query(id);
  }

  async function loadSelectedPage() {
    if (selectedPageId) loadPage(selectedPageId);
  }
</script>

<div class="PageManager m-4 w-[500px]">
  <h1 class="text-white text-xl font-bold mb-2">Pages</h1>
  <div class="border border-white full h-[100px] mb-4 overflow-y-auto">
    <ul class="text-white">
      {#if !workspaceStore.pages.length}
        <li class="opacity-50 text-center select-none">No pages</li>
      {/if}

      {#each workspaceStore.pages as page}
        <li>
          <input
            type="button"
            value={page.title}
            class="text-white p-1 hover:bg-slate-600 [&.selected]:hidden w-full text-left cursor-pointer"
            class:selected={selectedPageId === page.id}
            onclick={() => selectPage(page.id)}
            ondblclick={() => loadPage(page.id)}
          />
        </li>
      {/each}
    </ul>
  </div>
  <div class="flex gap-4">
    <button
      class="text-white bg-slate-500 rounded-md cursor-pointer grow px-3 py-1"
      onclick={newPage}>New</button
    >
    <button
      class="text-white bg-slate-500 rounded-md cursor-pointer grow px-3 py-1"
      onclick={loadSelectedPage}>Load</button
    >
    <button
      class="text-white bg-slate-500 rounded-md cursor-pointer grow px-3 py-1"
      onclick={deleteSelectedPage}>Delete</button
    >
  </div>
</div>
