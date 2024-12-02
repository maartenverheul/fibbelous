<script lang="ts">
  import { onMount } from "svelte";
  import PageEditor from "./lib/PageEditor.svelte";
  import PageManager from "./lib/PageManager.svelte";
  import workspaceStore from "./workspace.svelte";
  import AddConnectionView from "./lib/views/AddConnectionView.svelte";

  onMount(() => {
    workspaceStore.init();
  });
</script>

<main class="w-full h-full">
  {#if workspaceStore.currentWorkspace == null}
    <AddConnectionView />
  {:else}
    <PageManager />
    <PageEditor />
  {/if}
</main>

<style>
</style>
