<script lang="ts">
  import create from "textdiff-create";
  import frontmatter from "frontmatter";
  import { debounce } from "throttle-debounce";
  import server from "../server.svelte";

  let lastSyncedContent = "";
  let content = $state("");

  let pageTitle = $state("Title");

  const delayedSync = debounce(1000, sync, {
    atBegin: false,
  });

  $effect(() => {
    if (server.activePage != null) {
      const { data, content: pageContent } = frontmatter(
        server.activePage.content
      );
      content = pageContent;
      lastSyncedContent = pageContent;
      console.log(data);
      pageTitle = data.title;
    }
  });

  function oninput(event: Event) {
    delayedSync();
  }

  function sync() {
    if (!server.activePage?.id) return;
    const diff = create(lastSyncedContent, content);
    server.currentServer!.trpc.workspace.pages.edit.mutate({
      id: server.activePage.id,
      diff: diff,
    });
    lastSyncedContent = content;
  }
</script>

<div
  class="PageEditor w-full h-full p-4 flex items-stretch justify-center relative"
>
  <div id="content" class="w-full h-full max-w-screen-xl flex flex-col">
    <input
      type="text"
      autocomplete="off"
      spellcheck="false"
      class="border border-black text-black w-full text-5xl font-bold border-none focus:outline-0"
      bind:value={pageTitle}
    />
    <textarea
      disabled={server.activePage === null}
      bind:value={content}
      {oninput}
      class="border border-black disabled:border-slate-500 text-black w-full border-none focus:outline-0 resize-none h-full"
    ></textarea>
  </div>
</div>
