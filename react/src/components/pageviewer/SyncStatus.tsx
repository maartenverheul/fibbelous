import { usePage } from "@/contexts/PageContext";
import { CircleAlert, CircleCheckBig } from "lucide-react";

export default function SyncStatus() {
  const page = usePage();

  function syncIcon() {
    if (page.syncStatus === "up-to-date") {
      return <CircleCheckBig className="w-4 h-4 text-emerald-500" />;
    }
    if (page.syncStatus === "error") {
      return <CircleAlert className="w-4 h-4 text-red-500" />;
    }
    return <div className="w-4 h-4 border-2 border-dashed rounded-full border-gray-500 animate-spin" />;
  }

  return <button className="cursor-pointer block">
    {syncIcon()}
  </button>
}