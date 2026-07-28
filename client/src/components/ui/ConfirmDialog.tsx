import * as Dialog from "@radix-ui/react-dialog";
import { PiX } from "react-icons/pi";
import { cn } from "../../lib/utils";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive confirm styling (default). */
  tone?: "danger" | "default";
  confirming?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  confirming = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-60 bg-black/50" />
        <Dialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-60 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2",
            "rounded-xl border border-app-border bg-app-surface p-5 shadow-xl outline-none",
          )}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5 pr-2">
              <Dialog.Title className="text-base font-semibold text-app-fg">
                {title}
              </Dialog.Title>
              <Dialog.Description className="text-sm leading-relaxed text-app-fg-muted">
                {description}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex size-8 shrink-0 items-center justify-center rounded-md",
                  "text-app-fg-muted hover:bg-app-border/45 hover:text-app-fg",
                )}
                aria-label="Close"
                disabled={confirming}
              >
                <PiX className="size-4" aria-hidden />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Dialog.Close asChild>
              <button
                type="button"
                className={cn(
                  "rounded-md border border-app-border bg-app-bg px-3.5 py-2 text-sm font-medium",
                  "text-app-fg hover:bg-app-border/35",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
                disabled={confirming}
              >
                {cancelLabel}
              </button>
            </Dialog.Close>
            <button
              type="button"
              className={cn(
                "rounded-md px-3.5 py-2 text-sm font-semibold text-white",
                "disabled:cursor-wait disabled:opacity-70",
                tone === "danger"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-blue-600 hover:bg-blue-700",
              )}
              disabled={confirming}
              onClick={() => void onConfirm()}
            >
              {confirming ? "Deleting…" : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
