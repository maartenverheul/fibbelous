import type { ComponentType } from "react";
import { isPagePathSegment, parsePageIdFromSegment, parsePageKey, humanizeSlug } from "./types/page";
import { HomePage } from "./pages/HomePage";
import { SettingsPage } from "./pages/SettingsPage";

export type AppRoute = {
  id: string;
  segment: string;
  label: string;
  component: ComponentType;
};

export const appRoutes: AppRoute[] = [
  { id: "home", segment: "", label: "Home", component: HomePage },
  { id: "settings", segment: "settings", label: "Settings", component: SettingsPage },
];

export type TabRouteInfo = {
  id: string;
  segment: string;
  label: string;
  pageId?: string | null;
};

export function getRouteById(id: string) {
  return appRoutes.find((route) => route.id === id);
}

export function getTabInfoFromSegment(segment: string): TabRouteInfo | null {
  if (segment === "") {
    return { id: "home", segment: "", label: "Home" };
  }

  const route = appRoutes.find((item) => item.segment === segment);
  if (route) {
    return { id: route.id, segment: route.segment, label: route.label };
  }

  if (isPagePathSegment(segment)) {
    const pageId = parsePageIdFromSegment(segment);
    const leaf = segment.split("/").pop() ?? "";
    const parsed = parsePageKey(leaf);
    if (!pageId || !parsed) return null;
    return {
      id: `page-${pageId}`,
      segment,
      label: humanizeSlug(parsed.pageSlug),
      pageId,
    };
  }

  return null;
}

export function buildWorkspacePath(slug: string, segment: string) {
  if (!segment) return `/${slug}`;
  return `/${slug}/${segment}`;
}

export function parseWorkspacePath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) {
    return { slug: null, segment: "" };
  }

  const [slug, ...rest] = parts;
  return { slug, segment: rest.join("/") };
}
