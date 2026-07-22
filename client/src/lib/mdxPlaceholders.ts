/** MDX tags that get placeholder BlockNote blocks until real UIs exist. */
export const MDX_PLACEHOLDER_TAGS = ["database", "unknown"] as const;

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

/** Match `<database ... />`, `<unknown ...></unknown>`, multiline attrs, etc. */
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

/** Serialize a DOM element back to an MDX/HTML tag string. */
export function elementToMdxTag(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
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

  // Also normalize marker divs back if any leaked through.
  for (const el of root.querySelectorAll("[data-content-type][data-raw]")) {
    const tag = el.getAttribute("data-content-type");
    const raw = el.getAttribute("data-raw");
    if (!tag || !raw || !isMdxPlaceholderTag(tag)) continue;
    const parsed = parseMdxTagString(unescapeHtmlAttr(raw));
    if (parsed) {
      el.replaceWith(parsed);
    }
  }

  return root.innerHTML;
}
