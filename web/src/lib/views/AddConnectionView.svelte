<script lang="ts">
  import type { Workspace } from "@fibbelous/server/lib";
  import serverStore from "../../server.svelte";
  import workspaceStore from "../../workspace.svelte";
  import type { RemoteWorkspace } from "../../types/RemoteWorkspace";

  let serverUrl = $state("");
  let connected = $state(false);
  let workspaces: RemoteWorkspace[] = $state([]);
  let error = $state("");

  async function loadServer(event: SubmitEvent) {
    event.preventDefault();
    try {
      if (!serverUrl.startsWith("http")) {
        serverUrl = `http://${serverUrl}`;
      }
      await serverStore.connect(serverUrl);
      connected = true;
      error = "";
      workspaces = (await serverStore.trpc.getWorkspaces.query()).map((w) => ({
        ...w,
        url: serverUrl,
      }));
    } catch (err) {
      error = (err as Error).message;
    }
  }

  async function addWorkspace(workspace: RemoteWorkspace) {
    await workspaceStore.open(workspace);
  }
</script>

<div
  class="AddConnectionView text-black h-full flex flex-col gap-4 items-center justify-center"
>
  <div class="card border border-black p-10 w-full max-w-screen-sm rounded-md">
    <h1 class="text-3xl mb-4 select-none">Connect to server</h1>

    {#if error}
      <p class="text-red-400 mb-2">{error}</p>
    {/if}

    <div class="flex gap-2">
      <form onsubmit={loadServer}>
        <input
          bind:value={serverUrl}
          type="text"
          name="url"
          class="border border-black px-2"
          placeholder="url"
        />

        <input
          disabled={!serverUrl}
          type="submit"
          value="Load"
          class="bg-gray-200 px-2 py-1 rounded-md cursor-pointer"
        />
      </form>
    </div>
  </div>
  {#if connected}
    <div
      class="card border border-black p-10 w-full max-w-screen-sm rounded-md"
    >
      <h1 class="text-3xl mb-4">Add workspace</h1>

      <div class="flex">
        {#each workspaces as workspace}
          <button
            class="w-24 h-24 bg-red-300 cursor-pointer"
            onclick={() => addWorkspace(workspace)}
          >
            {workspace.name}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>
