<script lang="ts">
  import Sidebar from "../lib/Sidebar.svelte";
</script>

<div class="EditorLayout w-full h-full flex">
  <div class="w-60">
    <Sidebar />
  </div>
  <div class="w-full">
    <slot />
  </div>
</div>
