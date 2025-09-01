import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useWorkspaceManager } from "@/contexts/WorkspaceManagerContext";

export default function WorkspaceRedirect() {
  const { list: workspaces, loaded } = useWorkspaceManager();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loaded) return;

    if (workspaces.length > 0) {
      navigate(`/${workspaces[0].slug}`, { replace: true });
    } else {
      navigate(`/_/settings/workspaces`, { replace: true });
    }
  }, [loaded, workspaces, navigate]);

  return null;
}
