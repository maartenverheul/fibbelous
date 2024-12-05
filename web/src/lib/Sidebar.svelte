<script lang="ts">
  import { link } from "../router.svelte";
  import workspaceStore from "../workspace.svelte";
  import server from "../server.svelte";
  import { Icon } from "svelte-icons-pack";
  import { BsTrash, BsPlus } from "svelte-icons-pack/bs";

  let selectedPageId: string | null = $state(null);

  async function newPage() {
    const page = await server.currentServer!.trpc.workspace.pages.create.query(
      {}
    );
    loadPage(page.id);
  }

  function deletePage(id: string) {
    server.currentServer!.trpc.workspace.pages.delete.query(id);
  }

  async function loadPage(id: string) {
    if (!id) return;
    selectedPageId = id;
    server.activePage =
      await server.currentServer!.trpc.workspace.pages.load.query(id);
  }
</script>

<div class="Sidebar w-full h-full bg-gray-100 border-r border-black py-2">
  <div class="flex group pl-4 px-2">
    <p class="text-sm select-none font-medium">Pages</p>
    <div class="ml-auto">
      <button
        class="hover:bg-gray-300 p-1 opacity-0 group-hover:opacity-30 hover:opacity-100 cursor-pointer rounded-md translate-y-[1px] transition-all duration-100"
        onclick={() => newPage()}
      >
        <Icon src={BsPlus} />
      </button>
    </div>
  </div>
  <ul class="px-2">
    {#each workspaceStore.pages as page}
      <li>
        <a
          use:link
          href="/pages/1"
          class="pl-2 text-sm p-1 cursor-pointer [.active]:bg-gray-200 hover:!bg-gray-300 transition-colors duration-100 rounded-md flex items-center justify-center group"
          class:active={selectedPageId === page.id}
          onclick={() => loadPage(page.id)}
        >
          <span>{page.title}</span>
          <div class="ml-auto">
            <button
              class="hover:bg-gray-300 p-1 opacity-0 group-hover:opacity-30 hover:opacity-100 cursor-pointer rounded-md translate-y-[1px] transition-all duration-100"
              onclick={() => deletePage(page.id)}
            >
              <Icon src={BsTrash} />
            </button>
          </div>
        </a>
      </li>
    {/each}
  </ul>
</div>
