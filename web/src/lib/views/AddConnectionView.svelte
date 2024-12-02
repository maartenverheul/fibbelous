<script lang="ts">
  import type { Workspace } from "@fibbelous/server/lib";
  import serverStore from "../../server.svelte";
  import workspaceStore from "../../workspace.svelte";
  import type { Server } from "../../Server";

  let serverUrl = $state("");
  let server: Server | null = $state(null);
  let connected = $state(false);
  let workspaces: Workspace[] = $state([]);
  let error = $state("");

  async function loadServer(event: SubmitEvent) {
    event.preventDefault();
    try {
      if (!serverUrl.startsWith("http")) {
        serverUrl = `http://${serverUrl}`;
      }
      server = await serverStore.connect(serverUrl);
      connected = true;
      error = "";
      workspaces = await server.getWorkspaces();
    } catch (err) {
      error = (err as Error).message;
    }
  }

  async function addWorkspace(workspace: Workspace) {
    await workspaceStore.open(server!, workspace);
  }
</script>

<div
  class="AddConnectionView text-white h-full flex items-center justify-center"
>
  <div class="card border border-white p-10 rounded-md">
    <h1 class="text-3xl text-center mb-4">Connect to server</h1>

    {#if error}
      <p class="text-red-400 mb-2">{error}</p>
    {/if}

    <div class="flex gap-2">
      <form onsubmit={loadServer}>
        <input
          bind:value={serverUrl}
          type="text"
          name="url"
          class="border border-white px-2"
          placeholder="url"
        />

        <input
          disabled={!serverUrl}
          type="submit"
          value="Load"
          class="bg-slate-700 px-2 py-1 rounded-md cursor-pointer"
        />
      </form>
    </div>
  </div>
  {#if connected}
    <div class="card border border-white p-10 rounded-md">
      <h1 class="text-3xl text-center mb-4">Add workspace</h1>

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
