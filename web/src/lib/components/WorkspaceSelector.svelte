<script lang="ts">
  import { Icon } from "svelte-icons-pack";
  import { BsChevronDoubleRight, BsGear, BsPlus } from "svelte-icons-pack/bs";
  import workspaceStore from "../../workspace.svelte";
  import settingsManager from "../../settings.svelte";

  let open = $state(false);

  const workspacesToOpen = $derived(
    workspaceStore.savedWorkspaces.filter(
      (w) => w.id !== workspaceStore.currentWorkspace!.id
    )
  );
</script>

<div class="WorkspaceSelector group relative" class:open>
  <button
    class="flex items-center w-full cursor-pointer bg-gray-100 hover:bg-gray-200 transition-colors duration-100 px-4 py-2 gap-2"
    onclick={() => (open = !open)}
  >
    <div class="icon text-2xl w-[32px]">😎</div>
    <span class="text-left">{workspaceStore.currentWorkspace!.name}</span>
    <Icon
      src={BsChevronDoubleRight}
      className="ml-auto opacity-0 group-hover:opacity-100 transition-all duration-200 group-[.open]:rotate-90"
    />
  </button>
  <div
    class="dropdown w-full h-0 group-[.open]:h-50 transition-all overflow-hidden group-[.open]:border-t border-gray-300"
  >
    <ul
      class="w-full h-full [.big]:overflow-y-auto"
      class:big={workspacesToOpen.length > 2}
    >
      {#each workspacesToOpen as workspace}
        <li class="">
          <button
            class="flex gap-2 cursor-pointer hover:bg-gray-200 transition-colors duration-100 w-full px-4 py-2"
            onclick={() => workspaceStore.open(workspace)}
          >
            <span class="w-[22px]">{workspace.icon ?? "😎"}</span><span
              >{workspace.name}</span
            >
          </button>
        </li>
      {/each}
      <li>
        <button
          class="flex gap-2 items-center cursor-pointer hover:bg-gray-200 transition-colors duration-100 w-full px-4 py-2"
          onclick={() => settingsManager.open("workspaces")}
        >
          <span class="w-[22px]">
            <Icon src={BsGear} />
          </span><span>Manage</span>
        </button>
      </li>
    </ul>
  </div>
</div>
