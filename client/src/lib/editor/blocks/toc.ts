import type { BlockNoteEditor } from "@blocknote/core";
import { mdxTagWriteName } from "../mdxPlaceholders";

export function tocDefaultRaw(): string {
  return `<${mdxTagWriteName("toc")} />`;
}

export type TocHeading = {
  id: string;
  level: number;
  text: string;
};

function inlineContentToPlainText(content: unknown): string {
  if (!Array.isArray(content)) return "";

  return content
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const node = item as Record<string, unknown>;

      if (node.type === "text" && typeof node.text === "string") {
        return node.text;
      }

      if (
        node.type === "pageLink" &&
        node.props &&
        typeof node.props === "object"
      ) {
        const props = node.props as Record<string, unknown>;
        return typeof props.name === "string" ? props.name : "";
      }

      if (typeof node.text === "string") return node.text;
      return "";
    })
    .join("");
}

/** Collect heading blocks in document order for the TOC outline. */
export function collectTocHeadings(
  editor: BlockNoteEditor<any, any, any>,
): TocHeading[] {
  const headings: TocHeading[] = [];

  editor.forEachBlock((block) => {
    if (block.type !== "heading") return true;

    const level = Number(
      (block.props as { level?: number }).level ?? 1,
    );
    const text = inlineContentToPlainText(
      (block as { content?: unknown }).content,
    ).trim();
    if (!text) return true;

    headings.push({
      id: block.id,
      level: Number.isFinite(level) ? level : 1,
      text,
    });
    return true;
  });

  return headings;
}

type TocRenderResult = {
  dom: HTMLElement;
  destroy?: () => void;
  stopEvent?: (event: Event) => boolean;
  ignoreMutation?: (mutation: { target: Node | null }) => boolean;
};

function scrollToHeading(
  editor: BlockNoteEditor<any, any, any>,
  blockId: string,
) {
  const root = editor.domElement;
  if (!root) return;

  const target = root.querySelector(
    `[data-id="${CSS.escape(blockId)}"]`,
  ) as HTMLElement | null;
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function paintTocList(
  list: HTMLElement,
  headings: TocHeading[],
  editor: BlockNoteEditor<any, any, any>,
) {
  list.replaceChildren();

  if (headings.length === 0) {
    const empty = document.createElement("p");
    empty.className = "bn-mdx-toc__empty";
    empty.textContent = "Add headings to build a table of contents";
    list.appendChild(empty);
    return;
  }

  const minLevel = Math.min(...headings.map((h) => h.level));

  for (const heading of headings) {
    const row = document.createElement("div");
    row.className = "bn-mdx-toc__row";
    row.style.setProperty(
      "--toc-indent",
      `${Math.max(0, heading.level - minLevel)}`,
    );

    const link = document.createElement("a");
    link.className = "bn-mdx-toc__link";
    link.href = `#${heading.id}`;
    link.textContent = heading.text;
    link.title = heading.text;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      scrollToHeading(editor, heading.id);
    });

    row.appendChild(link);
    list.appendChild(row);
  }
}

/** Live outline of page headings; stored markdown is always `<TOC />`. */
export function renderTocDom(
  editor: BlockNoteEditor<any, any, any>,
): TocRenderResult {
  const dom = document.createElement("nav");
  dom.className = "bn-mdx-toc";
  dom.contentEditable = "false";
  dom.setAttribute("aria-label", "Table of contents");

  const list = document.createElement("div");
  list.className = "bn-mdx-toc__list";
  dom.appendChild(list);

  const refresh = () => {
    paintTocList(list, collectTocHeadings(editor), editor);
  };

  refresh();
  const unsubscribe = editor.onChange(refresh);

  return {
    dom,
    destroy: () => {
      unsubscribe();
    },
    stopEvent: (event) => {
      const target = event.target as Node | null;
      return !!target && dom.contains(target);
    },
    ignoreMutation: (mutation) => {
      const target = mutation.target;
      return !!target && dom.contains(target);
    },
  };
}
