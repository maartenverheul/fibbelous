<script lang="ts">
  import { onMount } from "svelte";
  import PageEditor from "./lib/PageEditor.svelte";
  import workspaceStore from "./workspace.svelte";
  import AddConnectionView from "./lib/views/AddConnectionView.svelte";
  import serverStore from "./server.svelte";
  import Sidebar from "./lib/Sidebar.svelte";
  import EditorLayout from "./layouts/EditorLayout.svelte";
  import FullscreenLayout from "./layouts/FullscreenLayout.svelte";

  onMount(() => {
    serverStore.currentServer?.disconnect();
    workspaceStore.init();
  });
</script>

<main class="w-full h-full">
  {#if workspaceStore.currentWorkspace == null}
    <FullscreenLayout>
      <AddConnectionView />
    </FullscreenLayout>
  {:else}
    <EditorLayout>
      <PageEditor />
    </EditorLayout>
  {/if}
</main>

<style>
</style>
