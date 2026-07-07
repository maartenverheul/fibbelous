import * as Select from "@radix-ui/react-select";
import { useState } from "react";
import { PiCaretDown, PiGear, PiPlus } from "react-icons/pi";
import { useWorkspace } from "../../context/WorkspaceContext";
import { cn } from "../../lib/utils";
import {
  WorkspaceManagerDialog,
  type WorkspaceManagerTab,
} from "./WorkspaceManagerDialog";

const NEW_WORKSPACE_VALUE = "__new__";

export function WorkspaceSelect() {
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspace();
  const [managerOpen, setManagerOpen] = useState(false);
  const [managerTab, setManagerTab] = useState<WorkspaceManagerTab>("browse");
  const [focusSavedWorkspaceId, setFocusSavedWorkspaceId] = useState<
    string | null
  >(null);

  const openManager = (
    tab: WorkspaceManagerTab,
    workspaceId: string | null = activeWorkspace?.id ?? null,
  ) => {
    setManagerTab(tab);
    setFocusSavedWorkspaceId(workspaceId);
    setManagerOpen(true);
  };

  return (
    <>
      <div className="min-w-0 w-full">
        <Select.Root
          value={activeWorkspace?.id ?? ""}
          onValueChange={(value) => {
            if (value === NEW_WORKSPACE_VALUE) {
              openManager("browse", null);
              return;
            }
            const workspace = workspaces.find((item) => item.id === value);
            if (workspace) setActiveWorkspace(workspace);
          }}
        >
          <Select.Trigger
            className={cn(
              "grid min-h-12 w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1 border-b border-[var(--app-border)] bg-[var(--app-surface)] py-2.5 pr-2 pl-3 text-left text-base font-medium text-stone-900 outline-none dark:text-stone-50",
            )}
            aria-label="Select workspace"
          >
            <Select.Value placeholder="Select workspace" className="truncate">
              {activeWorkspace
                ? `${activeWorkspace.icon ?? ""} ${activeWorkspace.label}`.trim()
                : "Select workspace"}
            </Select.Value>
            <span
              role="button"
              tabIndex={activeWorkspace ? 0 : -1}
              onPointerDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.stopPropagation();
                if (activeWorkspace) openManager("settings");
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                event.stopPropagation();
                if (activeWorkspace) openManager("settings");
              }}
              aria-disabled={!activeWorkspace}
              aria-label="Workspace settings"
              title="Workspace settings"
              className={cn(
                "flex shrink-0 items-center justify-center rounded p-1 text-stone-500 transition-colors",
                "hover:bg-stone-200/80 hover:text-stone-800",
                "dark:hover:bg-stone-800 dark:hover:text-stone-200",
                !activeWorkspace && "pointer-events-none opacity-40",
              )}
            >
              <PiGear className="h-4 w-4" aria-hidden />
            </span>
            <Select.Icon className="shrink-0 text-stone-500">
              <PiCaretDown className="h-4 w-4" aria-hidden />
            </Select.Icon>
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
                    "flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-base text-stone-600 outline-none dark:text-stone-400",
                    "data-[highlighted]:bg-stone-200/80 dark:data-[highlighted]:bg-stone-800",
                  )}
                >
                  <PiPlus className="h-4 w-4 shrink-0" aria-hidden />
                  <Select.ItemText>New workspace</Select.ItemText>
                </Select.Item>
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>

      <WorkspaceManagerDialog
        open={managerOpen}
        onOpenChange={setManagerOpen}
        initialTab={managerTab}
        focusSavedWorkspaceId={focusSavedWorkspaceId}
      />
    </>
  );
}
