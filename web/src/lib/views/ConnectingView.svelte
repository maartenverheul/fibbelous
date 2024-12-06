<script lang="ts">
  import workspaceStore from "../../workspace.svelte";

  let dots = 1;

  function updateDots() {
    dots = (dots % 3) + 1;
  }

  setInterval(updateDots, 500);
</script>

<div
  class="ConnectingView select-none z-50 bg-white text-black w-full h-full flex flex-col gap-4 items-center justify-center"
>
  <p class="text-5xl font-bold">Fibbelous</p>
  <p>
    Connecting to <span class="font-medium"
      >{workspaceStore.currentWorkspace?.name}</span
    ><span class="inline-block w-0">{".".repeat(dots)}</span>
  </p>
  <div class="mt-10">
    <p>Or connect to:</p>
    <ul class="mt-2">
      {#each workspaceStore.savedWorkspaces as workspace}
        <li>
          <button
            class="px-2 py-1 rounded-md hover:bg-gray-200 transition-colors duration-100 cursor-pointer select-none"
            ><span>{workspace.icon}</span>{workspace.name}</button
          >
        </li>
      {/each}
    </ul>
  </div>
</div>
