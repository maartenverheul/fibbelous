<script lang="ts">
  import { fade, scale } from "svelte/transition";
  import settingsManager from "../../settings.svelte";
  import { BsX } from "svelte-icons-pack/bs";
  import { Icon } from "svelte-icons-pack";
</script>

{#if settingsManager.isOpen}
  <div
    class="SettingsModal w-screen h-screen fixed left-0 top-0 z-40 flex items-center justify-center"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="wrapper absolute w-full h-full bg-black opacity-30"
      transition:fade={{ duration: 200 }}
      onclick={() => settingsManager.close()}
    ></div>
    <div
      class="w-full h-full sm:w-3/4 sm:h-3/4 lg:w-1/2 lg:h-2/3 shadow border border-gray-400 bg-white sm:rounded-md z-10 p-4 relative overflow-hidden"
      transition:scale={{ duration: 200, start: 0.9 }}
    >
      {#if !settingsManager.locked}
        <button
          class="absolute right-1 top-1 opacity-40 hover:opacity-100 transition-colors duration-100 cursor-pointer p-1 hover:bg-gray-100 rounded-md"
          onclick={() => settingsManager.close()}
          ><Icon src={BsX} size={24} />
        </button>
      {/if}
      <h1>Settings</h1>
    </div>
  </div>
{/if}
