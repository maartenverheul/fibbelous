import SettingsDialog, {
  tabs,
} from "@/components/dialogs/settings/SettingsDialog";
import { useAppNavigation } from "@/contexts/AppNavigationContext";

export default function SettingsDialogRoute() {
  const appNavigation = useAppNavigation();

  const open = appNavigation.hashParams[0] == "settings";

  function onOpenChange(open: boolean) {
    if (!open) appNavigation.navigate("#");
  }

  const activeTabName = appNavigation.hashParams[1];

  const activeTab =
    activeTabName && tabs.find((p) => p.key === activeTabName)
      ? activeTabName
      : tabs[0].key;

  return (
    <SettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      activeTab={activeTab}
      onTabChange={(t) =>
        appNavigation.navigate(appNavigation.settingsLink(t as any, null), {
          replace: true,
        })
      }
    />
  );
}
