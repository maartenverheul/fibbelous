import { SyncStatus } from "@/types/sync";
import SyncStatusBadge from "./SyncStatusBadge";

export default function TopBar() {
  const status: SyncStatus = "synced";

  return (
    <div className="w-full border-b flex items-center px-2 bg-black bg-opacity-5">
      <div className="ml-auto"></div>
      <SyncStatusBadge status={status} />
    </div>
  );
}
