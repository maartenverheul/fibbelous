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
  elementToMdxTag,
  MDX_PLACEHOLDER_TAG_RE,
  mdxTagsToBlockNoteMarkers,
  parseMdxTagString,
  sanitizeMdxPlaceholderHtml,
} from "./mdxPlaceholders";

const markdownToHtmlProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkBreaks)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeStringify);

const htmlToMarkdownProcessor = unified()
  .use(rehypeParse, { fragment: true })
  .use(rehypeRemark)
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
  const next = html.replace(MDX_PLACEHOLDER_TAG_RE, (match) => {
    const index = tags.length;
    const parsed = parseMdxTagString(match);
    tags.push(parsed ? elementToMdxTag(parsed) : match.trim());
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

  // Turn <database … /> into closed div markers before HTML5 parsing, otherwise
  // custom self-closing tags are treated as open and can swallow following blocks.
  const prepared = mdxTagsToBlockNoteMarkers(markdown);
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
