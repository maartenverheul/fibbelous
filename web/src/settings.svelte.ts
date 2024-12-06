export const settingsPages = {
  Home: "home",
  Workspaces: "workspaces",
} as const;

export type SettingsPage = (typeof settingsPages)[keyof typeof settingsPages];

class SettingsManager {
  public isOpen = $state(false);
  public locked = $state(false);

  open(page: SettingsPage) {
    this.isOpen = true;
  }

  close() {
    if (!this.locked) this.isOpen = false;
  }
}

const settingsManager = new SettingsManager();
export default settingsManager;
