import * as Select from "@radix-ui/react-select";
import { useState } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { cn } from "../../lib/utils";
import { WorkspaceManagerDialog } from "./WorkspaceManagerDialog";

const NEW_WORKSPACE_VALUE = "__new__";

export function WorkspaceSelect() {
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspace();
  const [managerOpen, setManagerOpen] = useState(false);

  return (
    <>
      <Select.Root
        value={activeWorkspace?.id ?? ""}
        onValueChange={(value) => {
          if (value === NEW_WORKSPACE_VALUE) {
            setManagerOpen(true);
            return;
          }
          const workspace = workspaces.find((item) => item.id === value);
          if (workspace) setActiveWorkspace(workspace);
        }}
      >
        <Select.Trigger
          className={cn(
            "flex min-h-12 w-full items-center justify-between gap-2 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2.5 text-left text-base font-medium text-stone-900 outline-none dark:text-stone-50",
          )}
          aria-label="Select workspace"
        >
          <Select.Value placeholder="Select workspace">
            {activeWorkspace
              ? `${activeWorkspace.icon ?? ""} ${activeWorkspace.label}`.trim()
              : "Select workspace"}
          </Select.Value>
          <Select.Icon className="text-stone-500">▾</Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            className={cn(
              "z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] text-stone-900 shadow-lg dark:text-stone-50",
            )}
            position="popper"
            sideOffset={4}
          >
            <Select.Viewport className="p-1">
              {workspaces.map((workspace) => (
                <Select.Item
                  key={workspace.id}
                  value={workspace.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-base outline-none",
                    "data-[highlighted]:bg-stone-200/80 dark:data-[highlighted]:bg-stone-800",
                  )}
                >
                  <Select.ItemText>
                    {workspace.icon ? `${workspace.icon} ` : ""}
                    {workspace.label}
                  </Select.ItemText>
                </Select.Item>
              ))}
              <Select.Separator className="my-1 h-px bg-[var(--app-border)]" />
              <Select.Item
                value={NEW_WORKSPACE_VALUE}
                className={cn(
                  "flex cursor-pointer items-center rounded px-3 py-2 text-base text-stone-600 outline-none dark:text-stone-400",
                  "data-[highlighted]:bg-stone-200/80 dark:data-[highlighted]:bg-stone-800",
                )}
              >
                <Select.ItemText>+ New</Select.ItemText>
              </Select.Item>
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>

      <WorkspaceManagerDialog open={managerOpen} onOpenChange={setManagerOpen} />
    </>
  );
}
