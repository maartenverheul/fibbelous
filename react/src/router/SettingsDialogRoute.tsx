import SettingsDialog from "@/dialogs/settings";
import { useNavigate, useParams } from "react-router";

const validTabs = ["general", "workspaces"];

export default function SettingsDialogRoute() {
  const navigate = useNavigate();
  const { tab = "general" } = useParams();

  const open = true;
  const onOpenChange = (open: boolean) => {
    if (!open) navigate("..", { replace: true });
  };

  return (
    <SettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      activeTab={validTabs.includes(tab) ? tab : "general"}
      onTabChange={(t) => navigate(`/settings/${t}`, { replace: true })}
    />
  );
}
