<script lang="ts">
  import { onMount } from "svelte";
  import SettingsModal from "../components/SettingsModal.svelte";
  import Sidebar from "../components/Sidebar.svelte";

  onMount(() => {
    console.log("EditorLayout mounted");
  });
</script>

<div class="EditorLayout w-full h-full flex">
  <SettingsModal />
  <div class="w-1/5">
    <Sidebar />
  </div>
  <div class="w-full">
    <slot />
  </div>
</div>
