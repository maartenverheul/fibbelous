import rehypeParse from "rehype-parse";
import rehypeRaw from "rehype-raw";
import rehypeRemark from "rehype-remark";
import rehypeStringify from "rehype-stringify";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import {
  colorPreserveHandlers,
  rehypeCompactColors,
  rehypeExpandColors,
} from "./colorMarkdown";
import {
  MDX_PLACEHOLDER_TAG_RE,
  mdxTagsToBlockNoteMarkers,
  sanitizeMdxPlaceholderHtml,
} from "./mdxPlaceholders";
import {
  mentionDateTagsToMarkers,
  MENTION_DATE_TAG_RE,
  unescapeHtmlAttr,
} from "./mentionDate";

const markdownToHtmlProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkBreaks)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeExpandColors)
  .use(rehypeStringify);

const htmlToMarkdownProcessor = unified()
  .use(rehypeParse, { fragment: true })
  .use(rehypeCompactColors)
  .use(rehypeRemark, { handlers: colorPreserveHandlers })
  .use(remarkGfm)
  .use(remarkBreaks)
  .use(remarkStringify, {
    bullet: "-",
    fences: true,
    rule: "-",
  });

/** BlockNote emits `***` for `<hr>`; prefer `---` thematic breaks. */
export function preferDashThematicBreaks(markdown: string): string {
  return markdown.replace(/^[ \t]*\*{3,}[ \t]*$/gm, "---");
}

const MDX_TOKEN_RE = /MDXPLACEHOLDER(\d+)ENDMDX/g;

/**
 * Protect MDX placeholder tags so remark round-trips keep them as raw HTML
 * instead of stripping unknown elements.
 */
export function protectMdxPlaceholderTags(html: string): {
  html: string;
  tags: string[];
} {
  const tags: string[] = [];

  const pushEscapedTag = (escaped: string) => {
    const index = tags.length;
    tags.push(unescapeHtmlAttr(escaped));
    return index;
  };

  // Inline MDX carriers (e.g. MentionDate) — keep mid-paragraph placement.
  let next = html.replace(
    /<span\b[^>]*\bdata-mdx-export-inline\b[^>]*>([\s\S]*?)<\/span>/gi,
    (_match, escaped: string) => {
      return `MDXPLACEHOLDER${pushEscapedTag(escaped)}ENDMDX`;
    },
  );

  // Prefer export carriers — they keep the exact written casing from data-raw.
  next = next.replace(
    /<span\b[^>]*\bdata-mdx-export\b[^>]*>([\s\S]*?)<\/span>/gi,
    (_match, escaped: string) => {
      return `<p>MDXPLACEHOLDER${pushEscapedTag(escaped)}ENDMDX</p>`;
    },
  );

  // Bare MentionDate tags that skipped the carrier path (inline token).
  next = next.replace(MENTION_DATE_TAG_RE, (match) => {
    const index = tags.length;
    tags.push(match.trim());
    return `MDXPLACEHOLDER${index}ENDMDX`;
  });

  // Bare block tags (legacy export): keep the matched spelling, do not re-case.
  next = next.replace(MDX_PLACEHOLDER_TAG_RE, (match) => {
    const index = tags.length;
    tags.push(match.trim());
    return `<p>MDXPLACEHOLDER${index}ENDMDX</p>`;
  });

  return { html: next, tags };
}

export function restoreMdxPlaceholderTags(
  markdown: string,
  tags: string[],
): string {
  return markdown.replace(MDX_TOKEN_RE, (_, index: string) => {
    return tags[Number(index)] ?? "";
  });
}

export async function markdownToHtml(markdown: string): Promise<string> {
  if (!markdown.trim()) {
    return "<p></p>";
  }

  // Turn <Database … /> / <MentionDate … /> into closed markers before HTML5
  // parsing, otherwise custom self-closing tags can swallow following content.
  const prepared = mentionDateTagsToMarkers(
    mdxTagsToBlockNoteMarkers(markdown),
  );
  const file = await markdownToHtmlProcessor.process(prepared);
  return String(file);
}

export async function htmlToMarkdown(html: string): Promise<string> {
  if (!html.trim()) {
    return "";
  }

  const cleaned = sanitizeMdxPlaceholderHtml(html);
  const { html: protectedHtml, tags } = protectMdxPlaceholderTags(cleaned);
  const file = await htmlToMarkdownProcessor.process(protectedHtml);
  const markdown = restoreMdxPlaceholderTags(String(file).trim(), tags);
  return preferDashThematicBreaks(markdown);
}
