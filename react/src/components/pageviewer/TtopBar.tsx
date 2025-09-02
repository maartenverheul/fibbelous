import { CircleCheckBig } from "lucide-react";
import Breadcrumbs from "./Tbreadcrumbs";
import { cn } from "@/lib/utils";

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
      <button className="cursor-pointer block ml-auto px-6">
        <CircleCheckBig className="w-4 h-4 text-emerald-500" />
      </button>
    </div>
  );
}
