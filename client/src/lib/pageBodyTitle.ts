function isMarkdownH1Line(line: string): boolean {
  return /^#\s+/.test(line) && !/^#{2,}/.test(line);
}

export function stripLeadingH1(markdown: string): string {
  if (!markdown.trim()) {
    return markdown;
  }

  const lines = markdown.split("\n");
  const firstLine = lines[0] ?? "";

  if (!isMarkdownH1Line(firstLine)) {
    return markdown;
  }

  let start = 1;
  while (start < lines.length && lines[start] === "") {
    start++;
  }

  return lines.slice(start).join("\n");
}

export function ensureLeadingH1(markdown: string, title: string): string {
  const trimmedTitle = title.trim();
  const content = stripLeadingH1(markdown);

  if (!trimmedTitle) {
    return content;
  }

  const heading = `# ${trimmedTitle}`;
  if (!content.trim()) {
    return heading;
  }

  return `${heading}\n\n${content}`;
}

function normalizeStoredBody(body: string): string {
  return body.replace(/\n{3,}/g, "\n\n").trimEnd();
}

export function bodyMatchesStored(
  editorBody: string,
  title: string,
  storedBody: string,
): boolean {
  return (
    normalizeStoredBody(ensureLeadingH1(editorBody, title)) ===
    normalizeStoredBody(storedBody)
  );
}

type HeadingBlock = {
  type: string;
  props?: { level?: number };
};

export function dropLeadingH1Block<T extends HeadingBlock>(blocks: T[]): T[] {
  const first = blocks[0];
  if (first?.type === "heading" && first.props?.level === 1) {
    return blocks.slice(1);
  }
  return blocks;
}
