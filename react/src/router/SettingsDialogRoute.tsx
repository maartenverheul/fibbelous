import SettingsDialog, { pages } from "@/dialogs/settings";
import { useLocation, useNavigate } from "react-router";

export default function SettingsDialogRoute() {
  const navigate = useNavigate();
  const { hash } = useLocation();

  const open = hash?.startsWith("#settings/") ?? false;

  function onOpenChange(open: boolean) {
    if (!open) navigate("#");
  }

  const activeTabName = hash?.substring(10);

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
