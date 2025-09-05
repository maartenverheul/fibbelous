import { useWorkspace } from "@/contexts/WorkspaceContext";

export default function WorkspaceHome() {
  const workspace = useWorkspace();

  if (!workspace) return null;

  return (
    <div className="w-full h-full bg-gray-700 p-10">
      <div className="flex items-center gap-4 rounded bg-gray-600 p-2 mb-4">
        <div className="text-4xl rounded-md hover:bg-gray-500 cursor-pointer w-14 h-14 flex items-center justify-center">{workspace.info?.icon}</div>
        <h1 className="text-white text-4xl font-bold">{workspace.info?.title}</h1>
      </div>
      <h2 className="text-white text-xl font-bold">Recent Activity</h2>
    </div>
  );
}