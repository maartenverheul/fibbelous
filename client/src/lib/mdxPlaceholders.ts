/** Custom MDX tags that get dedicated BlockNote blocks (placeholders or rich UI). */
export const MDX_PLACEHOLDER_TAGS = [
  "database",
  "unknown",
  "bookmark",
  "maps",
] as const;

export type MdxPlaceholderTag = (typeof MDX_PLACEHOLDER_TAGS)[number];

const MDX_TAG_SET = new Set<string>(MDX_PLACEHOLDER_TAGS);

export function isMdxPlaceholderTag(tag: string): tag is MdxPlaceholderTag {
  return MDX_TAG_SET.has(tag.toLowerCase());
}

/**
 * BlockNote mirrors block props onto exported HTML as `data-*` (e.g. `raw` →
 * `data-raw`). Only strip those bookkeeping attrs — real MDX attrs like
 * `data-source-url` must be kept.
 */
const BLOCKNOTE_PROP_ATTRS = new Set([
  "data-raw",
  "data-url",
  "data-content-type",
  "data-nesting-level",
  "data-file-block",
  "data-node-type",
  "data-node-view-wrapper",
  "data-id",
  "data-editable",
  "data-mdx-tag",
]);

function isBlockNotePropAttr(name: string): boolean {
  return BLOCKNOTE_PROP_ATTRS.has(name);
}

/** Match `<Database ... />`, `<Unknown ...></Unknown>`, multiline attrs, etc. */
export const MDX_PLACEHOLDER_TAG_RE = new RegExp(
  `<(${MDX_PLACEHOLDER_TAGS.join("|")})(\\s[^>]*?)?\\s*(?:\\/>|>([\\s\\S]*?)<\\/\\1>)`,
  "gi",
);

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function unescapeHtmlAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Written form for new custom MDX tags: `maps` → `Maps`. */
export function mdxTagWriteName(tag: string): string {
  const lower = tag.toLowerCase();
  if (!lower) return tag;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Exact tag spelling from a stored raw string, or null if not a placeholder. */
export function mdxTagNameFromRaw(raw: string): string | null {
  MDX_PLACEHOLDER_TAG_RE.lastIndex = 0;
  const match = MDX_PLACEHOLDER_TAG_RE.exec(raw.trim());
  return match?.[1] ?? null;
}

/**
 * Serialize a DOM element back to an MDX/HTML tag string.
 * Pass `writeName` to preserve existing casing or use the capitalized new-tag form.
 * Without it, uses lowercase (DOM round-trip default).
 */
export function elementToMdxTag(el: HTMLElement, writeName?: string): string {
  const tag = writeName ?? el.tagName.toLowerCase();
  const attrs = Array.from(el.attributes)
    .filter((attr) => !isBlockNotePropAttr(attr.name))
    .map((attr) => ` ${attr.name}="${escapeHtmlAttr(attr.value)}"`)
    .join("");

  const inner = el.innerHTML.trim();
  if (!inner) {
    return `<${tag}${attrs} />`;
  }
  return `<${tag}${attrs}>${el.innerHTML}</${tag}>`;
}

/** Build a raw tag string, keeping casing from `existingRaw` when present. */
export function mdxRawWithAttrs(
  tag: MdxPlaceholderTag,
  attrs: Record<string, string>,
  existingRaw?: string,
): string {
  const writeName =
    (existingRaw ? mdxTagNameFromRaw(existingRaw) : null) ??
    mdxTagWriteName(tag);
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value) el.setAttribute(name, value);
  }
  return elementToMdxTag(el, writeName);
}

/** Marker div that round-trips custom tags without losing write casing. */
export function mdxExportMarker(
  tag: MdxPlaceholderTag,
  raw: string,
): HTMLElement {
  const div = document.createElement("div");
  div.setAttribute("data-content-type", tag);
  div.setAttribute("data-raw", raw);
  return div;
}

/**
 * Rebuild a placeholder element from a stored raw tag string without HTML5
 * "non-void custom element" parsing (which ignores `/>` and can swallow siblings).
 */
export function parseMdxTagString(raw: string): HTMLElement | null {
  MDX_PLACEHOLDER_TAG_RE.lastIndex = 0;
  const match = MDX_PLACEHOLDER_TAG_RE.exec(raw.trim());
  if (!match) return null;

  const tag = match[1].toLowerCase();
  if (!isMdxPlaceholderTag(tag)) return null;

  const el = document.createElement(tag);
  const attrChunk = match[2] ?? "";
  const attrRe =
    /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let attrMatch: RegExpExecArray | null;
  while ((attrMatch = attrRe.exec(attrChunk)) !== null) {
    const name = attrMatch[1];
    if (!name || name === "/") continue;
    const value = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";
    el.setAttribute(name, value);
  }

  const inner = match[3];
  if (inner) {
    el.innerHTML = inner;
  }
  return el;
}

/**
 * Rewrite MDX placeholder tags in markdown to closed `<div data-content-type
 * data-raw>` markers so HTML5 parsing cannot absorb following blocks, and so
 * BlockNote's prop/`parse` path sees a stable shape.
 */
export function mdxTagsToBlockNoteMarkers(markdown: string): string {
  return markdown.replace(MDX_PLACEHOLDER_TAG_RE, (match, tagName: string) => {
    const raw = match.trim();
    return `\n\n<div data-content-type="${tagName.toLowerCase()}" data-raw="${escapeHtmlAttr(raw)}"></div>\n\n`;
  });
}

/** Drop BlockNote prop mirrors from placeholder tags in exported HTML. */
export function sanitizeMdxPlaceholderHtml(html: string): string {
  const doc = new DOMParser().parseFromString(
    `<div id="__mdx_root__">${html}</div>`,
    "text/html",
  );
  const root = doc.getElementById("__mdx_root__");
  if (!root) return html;

  for (const tag of MDX_PLACEHOLDER_TAGS) {
    for (const el of root.querySelectorAll(tag)) {
      for (const attr of Array.from(el.attributes)) {
        if (isBlockNotePropAttr(attr.name)) {
          el.removeAttribute(attr.name);
        }
      }
    }
  }

  // Keep exact `data-raw` casing via a text carrier — DOM tag serialization
  // would lowercase `<Maps>` back to `<maps>`.
  for (const el of root.querySelectorAll("[data-content-type][data-raw]")) {
    const tag = el.getAttribute("data-content-type");
    const raw = el.getAttribute("data-raw");
    if (!tag || !raw || !isMdxPlaceholderTag(tag)) continue;
    const carrier = doc.createElement("span");
    carrier.setAttribute("data-mdx-export", "");
    carrier.textContent = unescapeHtmlAttr(raw);
    el.replaceWith(carrier);
  }

  return root.innerHTML;
}

/** Read the `url` attribute from a stored raw MDX tag string. */
export function urlAttrFromMdxRaw(raw: string): string {
  const parsed = parseMdxTagString(raw);
  return parsed?.getAttribute("url")?.trim() ?? "";
}

/** Short label for bookmark chips (hostname + path, no scheme). */
export function bookmarkDisplayLabel(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname === "/" ? "" : u.pathname;
    return `${host}${path}${u.search}`;
  } catch {
    return url;
  }
}

/**
 * Decimal coordinates: `52.37, 4.90` / `52.37,4.90` / `52.37;4.90`.
 */
export function parseMapsCoordinates(
  input: string,
): { lat: number; lng: number } | null {
  const match = input
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function isGoogleMapsHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "maps.app.goo.gl" || host === "maps.google.com") return true;
  // google.com, www.google.nl, maps.google.co.uk, …
  return /(^|\.)google\.[a-z.]+$/.test(host);
}

/**
 * Accept only a Google Maps URL we can embed, or bare lat/lng coordinates.
 * Returns the normalized URL to store, or null to cancel.
 */
export function normalizeMapsInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const coords = parseMapsCoordinates(trimmed);
  if (coords) {
    return `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (!/^https?:$/i.test(parsed.protocol)) return null;
  if (!isGoogleMapsHost(parsed.hostname)) return null;

  // Must resolve to a real embed (rejects bare `/maps/@…` viewport links, etc.).
  if (!googleMapsEmbedSrc(trimmed)) return null;
  return trimmed;
}

/**
 * Turn a Google Maps place/search/share URL into an embeddable iframe `src`.
 * Already-embed URLs are returned as-is.
 *
 * The `@lat,lng,zoomz` camera segment is ignored — it is viewport-only and must
 * not become a pin or drive the embed. Prefer place / search / `q` identity.
 */
export function googleMapsEmbedSrc(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (!isGoogleMapsHost(host)) {
    return null;
  }

  if (parsed.pathname.includes("/maps/embed") || parsed.pathname.includes("/embed")) {
    return url;
  }

  const placeMatch = parsed.pathname.match(/\/maps\/place\/([^/]+)/);
  if (placeMatch) {
    const place = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
    return `https://www.google.com/maps?q=${encodeURIComponent(place)}&output=embed`;
  }

  const searchMatch = parsed.pathname.match(/\/maps\/(?:search|dir)\/([^/]+)/);
  if (searchMatch) {
    const q = decodeURIComponent(searchMatch[1].replace(/\+/g, " "));
    return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
  }

  const q = parsed.searchParams.get("q") ?? parsed.searchParams.get("query");
  if (q) {
    return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
  }

  // Short links: embed via the short URL as query (Google resolves it).
  if (host === "maps.app.goo.gl") {
    return `https://www.google.com/maps?q=${encodeURIComponent(url)}&output=embed`;
  }

  // Bare `/maps/@…` viewport links (and anything else without place/search/`q`) → reject.
  return null;
}
