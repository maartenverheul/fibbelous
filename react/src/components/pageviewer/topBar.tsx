import { CircleCheckBig } from "lucide-react";
import Breadcrumbs from "./breadcrumbs";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
}

export default function TopBar({ className }: Props) {
  return <div className={cn("flex bg-gray-800 border-b border-gray-700 h-min items-center p-1", className)}>
    <Breadcrumbs items={[
      { id: "1", title: "Home", icon: "🏠", children: [] },
      { id: "2", title: "Inside", icon: "🏠", children: [] }
    ]} />
    <button className="cursor-pointer block ml-auto px-6">
      <CircleCheckBig className="w-4 h-4 text-emerald-500" />
    </button>
  </div>
}