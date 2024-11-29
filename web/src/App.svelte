<script lang="ts">
  import { onDestroy, onMount, setContext } from "svelte";
  import PageEditor from "./lib/PageEditor.svelte";
  import PageManager from "./lib/PageManager.svelte";
  import server from "./server.svelte";

  onDestroy(() => {
    server.disconnect();
  });
</script>

<main>
  <PageManager />
  <PageEditor />
</main>

<style>
</style>
