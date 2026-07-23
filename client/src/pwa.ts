import { isTauri } from "@tauri-apps/api/core";
import { registerSW } from "virtual:pwa-register";

/** Register the service worker for hosted web builds only (not Tauri). */
export function registerPwa(): void {
  if (isTauri()) return;
  if (!("serviceWorker" in navigator)) return;

  registerSW({ immediate: true });
}
