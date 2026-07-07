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
  });

export async function markdownToHtml(markdown: string): Promise<string> {
  if (!markdown.trim()) {
    return "<p></p>";
  }

  const file = await markdownToHtmlProcessor.process(markdown);
  return String(file);
}

export async function htmlToMarkdown(html: string): Promise<string> {
  if (!html.trim()) {
    return "";
  }

  const file = await htmlToMarkdownProcessor.process(html);
  return String(file).trim();
}
