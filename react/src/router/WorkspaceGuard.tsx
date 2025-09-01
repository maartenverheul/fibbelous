import { useEffect } from "react";
import { Outlet, useNavigate, useParams } from "react-router";
import { useWorkspaceManager } from "@/contexts/WorkspaceManagerContext";

export default function WorkspaceGuard() {
  const { workspaceId } = useParams();
  const { list: workspaces, loaded } = useWorkspaceManager();
  const navigate = useNavigate();

  console.log("WG");


  useEffect(() => {
    if (!loaded) return;

    if (workspaceId && !workspaces.some((w) => w.id === workspaceId)) {
      // Invalid workspace, redirect to first valid workspace
      if (workspaces.length > 0) {
        navigate(`/${workspaces[0].slug}`, { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }
  }, [loaded, workspaceId, workspaces, navigate]);

  return <Outlet />;
}
