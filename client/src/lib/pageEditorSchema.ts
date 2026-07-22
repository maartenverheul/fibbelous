import {
  BlockNoteSchema,
  createBlockSpec,
  defaultBlockSpecs,
  type BlockNoteEditor,
} from "@blocknote/core";
import {
  elementToMdxTag,
  parseMdxTagString,
  type MdxPlaceholderTag,
} from "./mdxPlaceholders";

export {
  elementToMdxTag,
  isMdxPlaceholderTag,
  MDX_PLACEHOLDER_TAGS,
  type MdxPlaceholderTag,
} from "./mdxPlaceholders";

function createMdxPlaceholderBlockSpec(tag: MdxPlaceholderTag) {
  const defaultRaw = `<${tag} />`;

  return createBlockSpec(
    {
      type: tag,
      propSchema: {
        raw: {
          default: defaultRaw,
        },
      },
      content: "none",
    },
    {
      meta: {
        selectable: true,
      },
      parse(element) {
        // Markers produced by mdxTagsToBlockNoteMarkers / BlockNote export.
        if (
          element.tagName === "DIV" &&
          element.getAttribute("data-content-type") === tag
        ) {
          const fromAttr = element.getAttribute("data-raw");
          if (fromAttr) {
            return { raw: fromAttr };
          }
        }

        if (element.tagName.toLowerCase() !== tag) {
          return undefined;
        }
        return { raw: elementToMdxTag(element) };
      },
      render(block) {
        const dom = document.createElement("div");
        dom.className = "bn-mdx-placeholder";
        dom.dataset.mdxTag = tag;
        dom.contentEditable = "false";
        dom.textContent = String(block.props.raw);
        return { dom };
      },
      toExternalHTML(block) {
        const raw = String(block.props.raw);
        const parsed = parseMdxTagString(raw);
        if (parsed && parsed.tagName.toLowerCase() === tag) {
          return { dom: parsed.cloneNode(true) as HTMLElement };
        }
        const fallback = document.createElement(tag);
        return { dom: fallback };
      },
    },
  );
}

export const pageEditorSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    database: createMdxPlaceholderBlockSpec("database")(),
    unknown: createMdxPlaceholderBlockSpec("unknown")(),
  },
});

export type PageEditor = BlockNoteEditor<
  typeof pageEditorSchema.blockSchema,
  typeof pageEditorSchema.inlineContentSchema,
  typeof pageEditorSchema.styleSchema
>;
