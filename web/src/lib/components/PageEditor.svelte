<script lang="ts">
  import create from "textdiff-create";
  import { debounce } from "throttle-debounce";

  import remarkParse from "remark-parse";
  import remarkMdx from "remark-mdx";
  import remarkStringify from "remark-stringify";
  import { unified } from "unified";

  import type { LoadedPage } from "@fibbelous/server/lib";
  import server from "../../server.svelte";

  let lastSyncedContent = "";
  let content = $state("");
  let pageTitle = $state("");

  $effect(() => {
    if (server.activePage != null) loadPage(server.activePage);
  });

  $effect(() => {
    pageTitle;
    console.log("title changed");

    delayedUpdate();
  });

  function loadPage(page: LoadedPage) {
    content = page.content;
    lastSyncedContent = page.content;
    pageTitle = page.title;

    unified()
      .use(remarkParse)
      .use(remarkStringify)
      .use(remarkMdx)
      .use(() => (tree: any, list, done) => {
        list.data.mdx = tree;
        done();
      })
      .process(server.activePage!.content)
      .then((result) => {
        // console.log(result);
      });
  }

  function oninput(event: Event) {
    delayedSync();
  }

  const delayedSync = debounce(1000, sync, {
    atBegin: false,
  });

  function sync() {
    if (!server.activePage?.id) return;
    const diff = create(lastSyncedContent, content);
    server.trpc.workspace.pages.update.mutate({
      id: server.activePage.id,
      diff: diff,
    });
    lastSyncedContent = content;
  }

  const delayedUpdate = debounce(1000, update, {
    atBegin: false,
  });

  function update() {
    if (!server.activePage?.id) return;
    server.trpc.workspace.pages.update.mutate({
      id: server.activePage.id,
      title: pageTitle,
    });
  }
</script>

<div
  class="PageEditor w-full h-full p-4 flex items-stretch justify-center relative"
>
  {#if server.activePage === null}
    <div
      class="w-full h-full flex items-center justify-center select-none pointer-events-none"
    >
      <p class="opacity-30">Empty</p>
    </div>
  {:else}
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
  {/if}
</div>
