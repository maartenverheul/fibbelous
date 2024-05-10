import SyncStatusBadge from "./SyncStatusBadge";
import { usePageEditor } from "@/hooks";

export default function TopBar() {
  const pageEditor = usePageEditor();

  return (
    <div className="w-full border-b flex items-center px-2 bg-black bg-opacity-5">
      <div className="ml-auto"></div>
      <SyncStatusBadge status={pageEditor.syncStatus} />
    </div>
  );
}
