import { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";

export default function WorkspaceGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspaceId } = useParams();
  const { workspaces } = useWorkspaceContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (workspaceId && !workspaces.some((w) => w.id === workspaceId)) {
      // Invalid workspace, redirect to first valid workspace
      if (workspaces.length > 0) {
        navigate(`/${workspaces[0].id}`, { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }
  }, [workspaceId, workspaces, navigate]);

  return children;
}
