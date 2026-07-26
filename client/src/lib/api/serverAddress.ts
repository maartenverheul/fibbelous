export const DEFAULT_SERVER_URL = "http://127.0.0.1:8080";

export function parseServerUrl(input: string): URL | { error: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { error: "Enter a server URL" };
  }

  try {
    const url = new URL(
      /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
        ? trimmed
        : `https://${trimmed}`,
    );
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { error: "URL must be http or https" };
    }
    if (!url.hostname) {
      return { error: "Enter a valid server URL" };
    }
    return url;
  } catch {
    return { error: "Enter a valid server URL" };
  }
}

/** Canonical origin used for storage and API calls (`https://host:port`). */
export function normalizeServerUrl(url: URL): string {
  return url.origin;
}
