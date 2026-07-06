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
            "mb-3 flex min-h-10 w-full items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-left text-base font-medium text-zinc-900",
            "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100",
          )}
          aria-label="Select workspace"
        >
          <Select.Value placeholder="Select workspace">
            {activeWorkspace
              ? `${activeWorkspace.icon ?? ""} ${activeWorkspace.label}`.trim()
              : "Select workspace"}
          </Select.Value>
          <Select.Icon className="text-zinc-400">▾</Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            className={cn(
              "z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-zinc-200 bg-white text-zinc-900 shadow-lg",
              "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100",
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
                    "data-[highlighted]:bg-zinc-100 dark:data-[highlighted]:bg-zinc-800",
                  )}
                >
                  <Select.ItemText>
                    {workspace.icon ? `${workspace.icon} ` : ""}
                    {workspace.label}
                  </Select.ItemText>
                </Select.Item>
              ))}
              <Select.Separator className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
              <Select.Item
                value={NEW_WORKSPACE_VALUE}
                className={cn(
                  "flex cursor-pointer items-center rounded px-3 py-2 text-base text-zinc-600 outline-none",
                  "dark:text-zinc-400",
                  "data-[highlighted]:bg-zinc-100 dark:data-[highlighted]:bg-zinc-800",
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
