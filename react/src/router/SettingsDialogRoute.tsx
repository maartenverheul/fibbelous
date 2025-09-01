import SettingsDialog, { pages } from "@/dialogs/settings";
import { useNavigate, useParams } from "react-router";

export default function SettingsDialogRoute() {
  const navigate = useNavigate();
  const { tab } = useParams();

  const open = true;
  const onOpenChange = (open: boolean) => {
    if (!open) navigate("..", { replace: true });
  };

  const activeTab =
    tab && pages.find((p) => p.key === tab) ? tab : pages[0].key;

  return (
    <SettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      activeTab={activeTab}
      onTabChange={(t) => navigate(`/_/settings/${t}`, { replace: true })}
    />
  );
}
