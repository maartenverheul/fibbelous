/**
 * Clipboard plain text that should paste as markdown.
 *
 * Broader than BlockNote's `isMarkdown`, which misses common single-line
 * constructs (lists, headings, quotes, …). Without this, accompanying
 * `text/html` wins and pastes those as plain paragraphs.
 */
export function looksLikeMarkdownPaste(text: string): boolean {
  const src = text.replace(/\r\n/g, "\n");
  if (!src.trim()) return false;

  // ATX headings: `# Title`
  if (/(?:^|\n)\s{0,3}#{1,6}\s+\S/.test(src)) return true;

  // Unordered / task lists (single line ok): `- item`, `* [ ] task`
  if (/(?:^|\n)\s{0,5}[-*+]\s+\S/.test(src)) return true;

  // Ordered lists (single line ok): `1. item`
  if (/(?:^|\n)\s{0,5}\d+[.)]\s+\S/.test(src)) return true;

  // Blockquotes: `> quote`
  if (/(?:^|\n)\s{0,3}>\s?\S/.test(src)) return true;

  // Fenced code blocks
  if (/(?:^|\n)(```|~~~)/.test(src)) return true;

  // Thematic breaks
  if (/(?:^|\n)\s{0,3}(-{3,}|\*{3,}|_{3,})\s*(?:\n|$)/.test(src)) return true;

  // Tables
  if (/^\s*\|.+\|\s*$/m.test(src)) return true;

  // Setext headings
  if (/(?:^|\n)\S[^\n]*\n[=-]{2,}\s*(?:\n|$)/.test(src)) return true;

  // Common inline markdown
  if (/(\*\*|__).+?\1/.test(src)) return true;
  if (/~~.+?~~/.test(src)) return true;
  if (/\[[^\]]+\]\([^)\s]+\)/.test(src)) return true;
  if (/(?:^|[^\w`])`[^`\n]+`(?=[^\w`]|$)/.test(src)) return true;

  return false;
}

/**
 * Notion stamps clipboard HTML with `<!-- notionvc: <uuid> -->`.
 * See Clipview / Windows HTML Format from a Notion copy.
 */
export function isNotionClipboardHtml(html: string): boolean {
  return /<!--\s*notionvc:/i.test(html);
}

/** Leading GFM / Notion-style checkbox marker in list item text. */
const TASK_MARKER_RE = /^[\s\u00a0]*\[([\sxX])\][\s\u00a0]+/;

/**
 * Notion (and similar) put literal `[ ] label` inside `<li>` instead of a
 * checkbox input. BlockNote only treats `input[type=checkbox]` as a task item,
 * so rewrite those markers into real checkboxes before HTML paste.
 */
export function promoteTaskListMarkersInHtml(html: string): {
  html: string;
  changed: boolean;
} {
  if (!html || !/\[(?:\s|x|X)\]/.test(html)) {
    return { html, changed: false };
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  let changed = false;

  for (const li of doc.querySelectorAll("li")) {
    if (li.querySelector('input[type="checkbox"]')) continue;

    const walker = doc.createTreeWalker(li, NodeFilter.SHOW_TEXT);
    let textNode: Text | null = null;
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (node.textContent && /[^\s\u00a0]/.test(node.textContent)) {
        textNode = node;
        break;
      }
    }
    if (!textNode?.textContent) continue;

    const match = textNode.textContent.match(TASK_MARKER_RE);
    if (!match) continue;

    const checked = match[1] !== " " && match[1] !== "\u00a0";
    textNode.textContent = textNode.textContent.slice(match[0].length);

    const input = doc.createElement("input");
    input.type = "checkbox";
    input.disabled = true;
    if (checked) {
      input.checked = true;
      input.setAttribute("checked", "");
    }
    li.insertBefore(input, li.firstChild);
    changed = true;
  }

  if (!changed) return { html, changed: false };
  return { html: doc.body.innerHTML, changed: true };
}

/**
 * Notion-specific HTML cleanup before BlockNote parse.
 * Extend here as more Notion clipboard quirks show up.
 */
export function normalizeNotionClipboardHtml(html: string): string {
  let next = html.replace(/<!--\s*notionvc:[^>]*-->/gi, "");
  next = promoteTaskListMarkersInHtml(next).html;
  return next;
}
