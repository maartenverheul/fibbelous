import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Nearest ancestor that actually scrolls vertically (or null for the viewport). */
export function getScrollParent(element: Element | null): Element | null {
  let node = element?.parentElement ?? null;
  while (node && node !== document.body && node !== document.documentElement) {
    const style = getComputedStyle(node);
    const overflowY = style.overflowY;
    const scrollsY =
      overflowY === "auto" ||
      overflowY === "scroll" ||
      overflowY === "overlay";
    // Skip overflow-x-only wrappers (overflow-x:auto computes overflow-y to auto
    // even when the element grows with content and never scrolls vertically).
    if (scrollsY && node.scrollHeight > node.clientHeight + 1) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/** Whether `element` intersects the vertical scrollport (with optional margin). */
export function isInVerticalScrollport(
  element: Element,
  marginPx = 0,
): boolean {
  const root = getScrollParent(element);
  const bounds = element.getBoundingClientRect();
  if (!root) {
    return (
      bounds.top < window.innerHeight + marginPx &&
      bounds.bottom > -marginPx
    );
  }
  const rootBounds = root.getBoundingClientRect();
  return (
    bounds.top < rootBounds.bottom + marginPx &&
    bounds.bottom > rootBounds.top - marginPx
  );
}

export function formatUnknownError(
  error: unknown,
  fallback = "Something went wrong",
): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message.trim()) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    for (const key of ["message", "error", "msg"] as const) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value;
    }
    try {
      return JSON.stringify(error);
    } catch {
      // ignore
    }
  }
  return fallback;
}
