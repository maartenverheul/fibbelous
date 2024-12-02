<script lang="ts">
  import { onMount } from "svelte";
  import PageEditor from "./lib/PageEditor.svelte";
  import PageManager from "./lib/PageManager.svelte";
  import server from "./server.svelte";

  onMount(() => {
    server.state.init();
  });
</script>

<main>
  <PageManager />
  <PageEditor />
</main>

<style>
</style>
