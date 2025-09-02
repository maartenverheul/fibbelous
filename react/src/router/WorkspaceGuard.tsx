import { PropsWithChildren, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { useWorkspaceManager } from "@/contexts/WorkspaceManagerContext";

export default function WorkspaceGuard({ children }: PropsWithChildren) {
  const { workspaceSlug } = useParams();
  const { list: workspaces, loaded } = useWorkspaceManager();
  const { hash } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loaded) return;

    // When no workspaces are loaded, navigate to the settings dialog
    if (workspaces.length == 0 && !hash.startsWith("#settings"))
      navigate("/#settings/workspaces");

    // If no workspace is selected, navigate to the first workspace
    if (!workspaceSlug && workspaces.length > 0) {
      navigate(`/${workspaces[0].slug}`, { replace: true });
    }

    // If the selected workspace is invalid, redirect back
    if (workspaceSlug && !workspaces.some((w) => w.slug === workspaceSlug)) {
      // Invalid workspace, redirect to first valid workspace
      navigate("/", { replace: true });
    }
  }, [loaded, workspaceSlug, workspaces, hash]);

  return children;
}
