<script lang="ts">
  import Sidebar from "../components/Sidebar.svelte";
</script>

<div class="EditorLayout w-full h-full flex">
  <div class="w-1/5">
    <Sidebar />
  </div>
  <div class="w-full">
    <slot />
  </div>
</div>
