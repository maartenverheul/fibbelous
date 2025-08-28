import { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";

export default function WorkspaceGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspaceId } = useParams();
  const { workspaces, loaded } = useWorkspaceContext();
  const navigate = useNavigate();

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

  return children;
}
