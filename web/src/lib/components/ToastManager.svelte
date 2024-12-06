<script lang="ts" module>
  import { fly } from "svelte/transition";
  import { Icon } from "svelte-icons-pack";
  import { BsX } from "svelte-icons-pack/bs";
  import { clear } from "localforage";

  type ToastType = "info" | "success" | "error";
  export class Toast {
    public readonly type: ToastType;
    public readonly message: string;
    public readonly title: string | null;
    public readonly duration: number;
    public readonly locked: boolean;

    private timeout: number | undefined;

    constructor(
      type: ToastType,
      message: string,
      title: string | null = null,
      duration: number = 0,
      locked: boolean = false
    ) {
      this.type = type;
      this.message = message;
      this.title = title;
      this.duration = duration;
      this.locked = locked;

      if (duration > 0) {
        this.timeout = window.setTimeout(() => this.close(), duration);
      }
    }

    close() {
      if (this.timeout) window.clearTimeout(this.timeout);
      const index = toasts.indexOf(this);
      if (index !== -1) toasts.splice(index, 1);
    }
  }

  let toasts = $state<Toast[]>([]);

  export function show(toast: Toast) {
    toasts.push(toast);
  }
</script>

<div
  class="ToastManager fixed bottom-0 right-0 z-40 pointer-events-none select-none p-2 flex flex-col gap-2"
>
  {#each toasts as toast}
    <button
      transition:fly={{ duration: 400, x: 10 }}
      class={`Toast text-left group relative pointer-events-auto cursor-pointer bg-red-300 rounded-md shadow-lg px-3 py-2 text-sm leading-4 pr-8 w-screen max-w-[400px] toast-${toast.type} 
        [.toast-info]:bg-blue-300
        [.toast-info]:hover:bg-blue-400
        [.toast-success]:bg-green-300
        [.toast-success]:hover:bg-green-400
        [.toast-error]:bg-red-300
        [.toast-error]:hover:bg-red-400
        transition-colors duration-100`}
      class:locked={toast.locked}
      onclick={() => toast.close()}
    >
      <p class="font-medium">{toast.title}</p>
      <p>{toast.message}</p>
      {#if !toast.locked}
        <Icon
          src={BsX}
          size={20}
          className="absolute right-1 top-1 cursor-pointer opacity-40 group-hover:opacity-100 transition-opacity duration-100"
        />
      {/if}
    </button>
  {/each}
</div>
