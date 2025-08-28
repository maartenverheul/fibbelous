import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";

export default function WorkspaceRedirect() {
  const { workspaces } = useWorkspaceContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (workspaces.length > 0) {
      navigate(`/${workspaces[0].slug}`, { replace: true });
    } else {
      navigate(`/settings/workspaces`, { replace: true });
    }
  }, [workspaces, navigate]);

  return null;
}
