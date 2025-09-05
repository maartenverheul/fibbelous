import SettingsDialog, { pages } from "@/components/dialogs/settings/SettingsDialog";
import { useAppNavigation } from "@/contexts/AppNavigationContext";
import { useNavigate } from "react-router";

export default function SettingsDialogRoute() {
  const appNavigation = useAppNavigation();
  const navigate = useNavigate();

  const open = appNavigation.hashParams[0] == "settings";

  function onOpenChange(open: boolean) {
    if (!open) navigate("#");
  }

  const activeTabName = appNavigation.hashParams[1];

  const activeTab =
    activeTabName && pages.find((p) => p.key === activeTabName)
      ? activeTabName
      : pages[0].key;

  return (
    <SettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      activeTab={activeTab}
      onTabChange={(t) => navigate(`#settings/${t}`, { replace: true })}
    />
  );
}
