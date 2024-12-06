<script lang="ts">
  import { crossfade, fade, scale } from "svelte/transition";

  import { onMount } from "svelte";
  import PageEditor from "./lib/components/PageEditor.svelte";
  import workspaceStore from "./workspace.svelte";
  import AddConnectionView from "./lib/views/AddConnectionView.svelte";
  import serverStore from "./server.svelte";
  import EditorLayout from "./lib/layouts/EditorLayout.svelte";
  import FullscreenLayout from "./lib/layouts/FullscreenLayout.svelte";
  import ConnectingView from "./lib/views/ConnectingView.svelte";
  import ToastManager from "./lib/components/ToastManager.svelte";

  onMount(() => {
    serverStore.disconnect();
    workspaceStore.init();
  });

  let showLoadingScreen = $state(true);

  $effect(() => {
    if (serverStore.connected && workspaceStore.currentWorkspace != null) {
      setTimeout(() => {
        showLoadingScreen = false;
      }, 1000);
    } else {
      showLoadingScreen = true;
    }
  });
</script>

<main class="w-full h-full">
  {#if showLoadingScreen}
    <div
      transition:fade={{ duration: 500 }}
      class="w-full h-full z-50 absolute"
    >
      <ConnectingView />
    </div>
  {/if}
  <ToastManager />
  {#if workspaceStore.currentWorkspace != null}
    <div class="w-full h-full">
      <EditorLayout>
        <PageEditor />
      </EditorLayout>
    </div>
  {:else}
    <div class="w-full h-full">
      <FullscreenLayout>
        <AddConnectionView />
      </FullscreenLayout>
    </div>
  {/if}
</main>

<style>
</style>
