import { PropsWithChildren, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { useWorkspaceManager } from "@/contexts/WorkspaceManagerContext";

export default function WorkspaceGuard({ children }: PropsWithChildren) {
  return children;
}
