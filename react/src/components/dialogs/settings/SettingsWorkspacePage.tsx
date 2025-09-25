import { Link } from "react-router";
// import { useState } from "react"; // no local state needed after refactor
import {
  ChevronRight,
  FolderSymlink,
  Link2OffIcon,
  Loader2Icon,
  PlusIcon,
  XIcon,
  GlobeIcon,
  FolderSymlinkIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useWorkspaceManager } from "@/contexts/WorkspaceManagerContext";
import { EyeIcon } from "lucide-react";
import {
  ConnectionType,
  CreateWorkspaceRequest,
  WorkspaceInfo,
} from "@/models";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { CollapsibleTrigger } from "@radix-ui/react-collapsible";
import AddWorkspaceForm from "./AddWorkspaceForm";
import EditWorkspaceForm from "./EditWorkspaceForm";
import { useAppNavigation } from "@/contexts/AppNavigationContext";
import { cn } from "@/lib/utils";
import { IS_APP } from "@/checks";
import { useEffect } from "react";

export default function SettingsWorkspacePage() {
  const {
    workspaces,
    removeWorkspace,
    openInSystem,
    loaded,
    forceRefreshRemote,
  } = useWorkspaceManager();
  const { hashParams, workspaceHomeLink } = useAppNavigation(); // not currently used
  const appNavigation = useAppNavigation();

  function handleVisit(workspace: WorkspaceInfo) {
    appNavigation.navigate(appNavigation.workspaceHomeLink(workspace));
  }

  useEffect(() => {
    console.log("Workspaces updated", workspaces);
  }, [workspaces]);

  function workspaceIcon(
    w: WorkspaceInfo,
    isOffline: boolean,
    isPending: boolean
  ) {
    if (isPending)
      return <Loader2Icon className="w-5 h-5 text-gray-300 animate-spin" />;
    if (isOffline) return <Link2OffIcon className="w-5 h-5 text-red-300" />;
    return w.icon;
  }

  function workspaceRemoteIcon(connectionType: ConnectionType) {
    if (connectionType === ConnectionType.remote)
      return <GlobeIcon className="w-4 h-4" />;
    return <FolderSymlinkIcon className="w-4 h-4" />;
  }

  function handleEditSave(
    workspace: CreateWorkspaceRequest
  ): void {
    console.log("EDIT", workspace);
    throw new Error("Function not implemented.");
  }

  return (
    <div className="SettingsWorkspacePage p-2 pr-4 select-none pb-10">
      <div className="flex items-center mb-4">
        <h2 className="text-lg font-bold mr-2">Workspaces</h2>
        <button
          type="button"
          onClick={forceRefreshRemote}
          className="p-1 rounded-sm text-gray-300 hover:text-white hover:bg-gray-600 disabled:opacity-40 cursor-pointer"
          title="Force refresh remote workspaces"
        >
          <RefreshCwIcon className="w-4 h-4" />
        </button>
      </div>
      {loaded && (
        <>
          <ul className="mb-4">
            {workspaces.map((w) => {
              const isOffline =
                !w.connectionState.checking && !w.connectionState.success;
              const isPending = w.connectionState.checking == true;

              return (
                <Collapsible
                  key={w.info.id}
                  defaultOpen={hashParams[2] === w.info.slug}
                  className="mb-2"
                >
                  <CollapsibleTrigger asChild>
                    <li
                      data-offline={isOffline ? "true" : undefined}
                      className={cn(
                        `flex cursor-pointer group items-center h-14 rounded-sm p-2 data-[state=open]:rounded-b-none transition-colors border bg-gray-700 border-transparent hover:bg-gray-600 data-[offline]:bg-red-900/60 data-[offline]:hover:bg-red-800/70 data-[offline]:border-red-900`,
                        {
                          "": isOffline,
                        }
                      )}
                    >
                      <div className="rounded-sm border aspect-square select-none h-8 flex items-center justify-center mr-2 transition-colors hover:bg-gray-500 hover:border-gray-400 border-transparent group-data-[offline]:hover:bg-transparent group-data-[offline]:hover:border-transparent">
                        {workspaceIcon(w.info, isOffline, isPending)}
                      </div>
                      <div className="flex flex-col">
                        <span className="flex items-center gap-4 text-lg truncate group-data-[offline]:text-red-300/80">
                          {w.info.title}
                        </span>
                        {!isPending && w.connectionState.success === false && (
                          <span className="text-sm text-red-300">
                            Error: {w.connectionState.error}
                          </span>
                        )}
                      </div>
                      <span className="group-data-[offline]:text-red-300/80 ml-4">
                        {workspaceRemoteIcon(w.connection.type)}
                      </span>
                      <div className="ml-auto flex items-center">
                        <Link
                          to={workspaceHomeLink(w.info)}
                          className="px-2 py-1 text-white opacity-40 hover:opacity-100 hover:text-white hover:bg-green-500 cursor-pointer rounded"
                          onClick={() => handleVisit(w.info)}
                          title="Load workspace"
                        >
                          <EyeIcon className="w-4" />
                        </Link>
                        {IS_APP && (
                          <button
                            className="px-2 py-1 text-white opacity-40 hover:opacity-100 hover:text-white hover:bg-yellow-500 cursor-pointer rounded"
                            onClick={() => openInSystem(w.info.id)}
                            title="Open in System"
                          >
                            <FolderSymlink className="w-4" />
                          </button>
                        )}
                        <button
                          className="px-2 py-1 text-white opacity-40 hover:opacity-100 hover:text-white hover:bg-red-500 cursor-pointer rounded"
                          onClick={() => removeWorkspace(w.info.id)}
                          title="Remove workspace"
                        >
                          <XIcon className="w-4" />
                        </button>
                        <ChevronRight className="ml-2 text-white opacity-40 group-data-[state=open]:rotate-90 w-5 h-5 transition-transform" />
                      </div>
                    </li>
                  </CollapsibleTrigger>
                  <CollapsibleContent
                    className={cn("bg-gray-700 p-4 pt-2 rounded-b-sm", {
                      "bg-red-900/60": isOffline,
                    })}
                  >
                    <EditWorkspaceForm
                      workspace={w}
                      readOnly={!w.connectionState.success}
                      onSave={handleEditSave}
                    />
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </ul>

          <Collapsible defaultOpen={workspaces.length == 0}>
            <CollapsibleTrigger className="flex items-center text-lg h-14 text-gray-300 bg-gray-700/50 px-3 rounded-sm group data-[state=open]:rounded-b-none p-2 w-full cursor-pointer">
              <PlusIcon className="w-5 h-5 ml-1 mr-3" />
              Add Workspace
              <ChevronRight className="ml-auto group-data-[state=open]:rotate-90 w-5 h-5 text-white opacity-40 transition-transform" />
            </CollapsibleTrigger>
            <CollapsibleContent className="bg-gray-700/50 p-4 pt-2 rounded-b-sm">
              <AddWorkspaceForm />
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </div>
  );
}
