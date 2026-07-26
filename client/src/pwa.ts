import { isTauri } from "@tauri-apps/api/core";
import { registerSW } from "virtual:pwa-register";
import { buildInfo } from "./lib/app/buildInfo";

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const VERSION_RELOAD_KEY = "fibbelous:version-reload";

type VersionPayload = {
  version: string;
  buildTime: string;
  gitCommit: string;
};

let swRegistration: ServiceWorkerRegistration | undefined;

function sameBuild(remote: VersionPayload): boolean {
  return (
    remote.version === buildInfo.version &&
    remote.buildTime === buildInfo.buildTime &&
    remote.gitCommit === buildInfo.gitCommit
  );
}

async function clearServiceWorkerCaches(): Promise<void> {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}

/** Fetch deployed version.json (never cache) and reload if the running build is stale. */
async function reloadIfDeployedVersionChanged(): Promise<boolean> {
  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!response.ok) return false;

    const remote = (await response.json()) as VersionPayload;
    if (sameBuild(remote)) {
      sessionStorage.removeItem(VERSION_RELOAD_KEY);
      return false;
    }

    const remoteKey = `${remote.version}|${remote.buildTime}|${remote.gitCommit}`;
    if (sessionStorage.getItem(VERSION_RELOAD_KEY) === remoteKey) {
      // Soft reload already tried; drop SW + caches so the next load is fresh.
      await clearServiceWorkerCaches();
      sessionStorage.removeItem(VERSION_RELOAD_KEY);
      window.location.reload();
      return true;
    }

    sessionStorage.setItem(VERSION_RELOAD_KEY, remoteKey);
    await swRegistration?.update();
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

function scheduleUpdateChecks(registration: ServiceWorkerRegistration): void {
  const check = () => {
    void registration.update();
    void reloadIfDeployedVersionChanged();
  };

  window.setInterval(check, UPDATE_CHECK_INTERVAL_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });

  window.addEventListener("focus", check);
}

/** Register the service worker for hosted web builds only (not Tauri). */
export function registerPwa(): void {
  if (isTauri()) return;
  if (!("serviceWorker" in navigator)) return;

  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      swRegistration = registration;
      scheduleUpdateChecks(registration);
      void reloadIfDeployedVersionChanged();
    },
  });
}

/** Ask the service worker to check for an update; returns whether one was waiting. */
export async function checkForAppUpdate(): Promise<"updated" | "current" | "unavailable"> {
  if (isTauri() || !("serviceWorker" in navigator)) return "unavailable";

  const registration =
    swRegistration ?? (await navigator.serviceWorker.getRegistration());

  if (!registration) return "unavailable";

  await registration.update();

  if (await reloadIfDeployedVersionChanged()) return "updated";

  if (registration.waiting) {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    return "updated";
  }

  return "current";
}
