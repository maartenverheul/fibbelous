import Breadcrumbs from "./Breadcrumbs";
import { cn } from "@/lib/utils";
import SyncStatus from "./SyncStatus";

type Props = {
  className?: string;
};

export default function TopBar({ className }: Props) {
  return (
    <div
      className={cn(
        "flex bg-gray-800 border-b border-gray-700 h-min items-center p-1",
        className
      )}
    >
      <Breadcrumbs />
      <div className="ml-auto px-6">
        <SyncStatus />
      </div>
    </div>
  );
}
