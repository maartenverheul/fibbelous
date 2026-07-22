import {
  BlockNoteSchema,
  createBlockSpec,
  defaultBlockSpecs,
  type BlockNoteEditor,
} from "@blocknote/core";
import { commitMapsUrl, mapsRawFromUrl } from "./mapsBlock";
import {
  bookmarkDisplayLabel,
  elementToMdxTag,
  googleMapsEmbedSrc,
  parseMdxTagString,
  urlAttrFromMdxRaw,
  type MdxPlaceholderTag,
} from "./mdxPlaceholders";
import { openExternalUrl } from "./tauri";

export {
  elementToMdxTag,
  isMdxPlaceholderTag,
  MDX_PLACEHOLDER_TAGS,
  type MdxPlaceholderTag,
} from "./mdxPlaceholders";

function parseMdxBlockProps(tag: MdxPlaceholderTag, element: HTMLElement) {
  if (
    element.tagName === "DIV" &&
    element.getAttribute("data-content-type") === tag
  ) {
    const fromAttr = element.getAttribute("data-raw");
    if (fromAttr) {
      return {
        raw: fromAttr,
        url: urlAttrFromMdxRaw(fromAttr),
      };
    }
  }

  if (element.tagName.toLowerCase() !== tag) {
    return undefined;
  }

  const raw = elementToMdxTag(element);
  return {
    raw,
    url: element.getAttribute("url")?.trim() ?? urlAttrFromMdxRaw(raw),
  };
}

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
        const parsed = parseMdxBlockProps(tag, element);
        if (!parsed) return undefined;
        return { raw: parsed.raw };
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

function createBookmarkBlockSpec() {
  return createBlockSpec(
    {
      type: "bookmark",
      propSchema: {
        raw: {
          default: `<bookmark url="" />`,
        },
        url: {
          default: "",
        },
      },
      content: "none",
    },
    {
      meta: {
        selectable: true,
      },
      parse(element) {
        return parseMdxBlockProps("bookmark", element);
      },
      render(block) {
        const url =
          String(block.props.url || "").trim() ||
          urlAttrFromMdxRaw(String(block.props.raw));
        const dom = renderBookmarkDom(url);
        dom.dataset.mdxTag = "bookmark";
        dom.contentEditable = "false";
        return { dom };
      },
      toExternalHTML(block) {
        const url =
          String(block.props.url || "").trim() ||
          urlAttrFromMdxRaw(String(block.props.raw));
        const el = document.createElement("bookmark");
        if (url) {
          el.setAttribute("url", url);
        }
        return { dom: el };
      },
    },
  );
}

function createMapsBlockSpec() {
  return createBlockSpec(
    {
      type: "maps",
      propSchema: {
        raw: {
          default: mapsRawFromUrl(""),
        },
        url: {
          default: "",
        },
      },
      content: "none",
    },
    {
      meta: {
        selectable: true,
      },
      parse(element) {
        return parseMdxBlockProps("maps", element);
      },
      render(block, editor) {
        const url =
          String(block.props.url || "").trim() ||
          urlAttrFromMdxRaw(String(block.props.raw));
        const { dom, destroy } = renderMapsDom(url, {
          editable: editor.isEditable,
          onCommitUrl: (nextUrl) => commitMapsUrl(editor, block.id, nextUrl),
        });
        dom.dataset.mdxTag = "maps";
        dom.contentEditable = "false";
        return { dom, destroy };
      },
      toExternalHTML(block) {
        const url =
          String(block.props.url || "").trim() ||
          urlAttrFromMdxRaw(String(block.props.raw));
        const el = document.createElement("maps");
        if (url) {
          el.setAttribute("url", url);
        }
        return { dom: el };
      },
    },
  );
}

function bindExternalOpen(link: HTMLAnchorElement, url: string) {
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void openExternalUrl(url);
  });
}

function renderBookmarkDom(url: string): HTMLElement {
  const dom = document.createElement("div");
  dom.className = "bn-mdx-bookmark";

  if (!url) {
    dom.classList.add("bn-mdx-bookmark--empty");
    dom.textContent = "Bookmark (missing url)";
    return dom;
  }

  const link = document.createElement("a");
  link.className = "bn-mdx-bookmark__link";
  link.textContent = bookmarkDisplayLabel(url);
  link.title = url;
  bindExternalOpen(link, url);
  dom.appendChild(link);
  return dom;
}

type MapsRenderOptions = {
  editable: boolean;
  onCommitUrl: (url: string) => boolean | void;
};

function renderMapsDom(
  url: string,
  options: MapsRenderOptions,
): { dom: HTMLElement; destroy?: () => void } {
  const dom = document.createElement("div");
  dom.className = "bn-mdx-maps";

  const embedSrc = url ? googleMapsEmbedSrc(url) : null;
  if (!embedSrc) {
    dom.classList.add("bn-mdx-maps--empty");

    if (!url && options.editable) {
      return {
        dom,
        destroy: mountMapsUrlInput(dom, options.onCommitUrl),
      };
    }

    if (!url) {
      dom.textContent = "Maps (missing url)";
      return { dom };
    }

    const link = document.createElement("a");
    link.className = "bn-mdx-maps__open";
    link.textContent = "Open in Maps";
    bindExternalOpen(link, url);
    dom.appendChild(link);
    return { dom };
  }

  const frame = document.createElement("iframe");
  frame.className = "bn-mdx-maps__frame";
  frame.src = embedSrc;
  frame.title = "Google Maps";
  frame.loading = "lazy";
  frame.referrerPolicy = "no-referrer-when-downgrade";
  frame.allowFullscreen = true;
  frame.setAttribute(
    "allow",
    "accelerometer; geolocation; gyroscope; clipboard-write",
  );
  dom.appendChild(frame);

  const openLink = document.createElement("a");
  openLink.className = "bn-mdx-maps__open";
  openLink.textContent = "Open in Maps";
  bindExternalOpen(openLink, url);
  dom.appendChild(openLink);

  return { dom };
}

function mountMapsUrlInput(
  container: HTMLElement,
  onCommitUrl: (url: string) => boolean | void,
): () => void {
  const label = document.createElement("div");
  label.className = "bn-mdx-maps__label";
  label.textContent = "Google Maps link or coordinates";

  const row = document.createElement("div");
  row.className = "bn-mdx-maps__form";

  const input = document.createElement("input");
  input.className = "bn-mdx-maps__input";
  input.type = "text";
  input.placeholder = "https://maps.google.com/… or 52.37, 4.90";
  input.autocomplete = "off";
  input.spellcheck = false;

  const submit = document.createElement("button");
  submit.type = "button";
  submit.className = "bn-mdx-maps__submit";
  submit.textContent = "Embed";

  const setError = (message: string | null) => {
    if (message) {
      label.textContent = message;
      label.classList.add("bn-mdx-maps__label--error");
      input.classList.add("bn-mdx-maps__input--error");
    } else {
      label.textContent = "Google Maps link or coordinates";
      label.classList.remove("bn-mdx-maps__label--error");
      input.classList.remove("bn-mdx-maps__input--error");
    }
  };

  const commit = () => {
    const accepted = onCommitUrl(input.value);
    if (accepted === false) {
      setError("Use a Google Maps link or lat, lng coordinates");
      input.focus();
      input.select();
      return;
    }
    setError(null);
  };

  const onMouseDown = (event: MouseEvent) => {
    // Keep focus in the input instead of the surrounding block selection.
    event.stopPropagation();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    // Stop editor shortcuts while typing/pasting in the URL field.
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
  };
  const onPaste = (event: ClipboardEvent) => {
    // BlockNote/ProseMirror otherwise steals paste from this input.
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const text = event.clipboardData?.getData("text")?.trim() ?? "";
    if (!text) return;

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = `${input.value.slice(0, start)}${text}${input.value.slice(end)}`;
    const cursor = start + text.length;
    input.setSelectionRange(cursor, cursor);
    setError(null);
  };
  const onSubmitClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    commit();
  };
  const onInput = () => setError(null);

  input.addEventListener("mousedown", onMouseDown);
  input.addEventListener("keydown", onKeyDown);
  input.addEventListener("paste", onPaste, true);
  input.addEventListener("input", onInput);
  submit.addEventListener("mousedown", onMouseDown);
  submit.addEventListener("click", onSubmitClick);

  row.appendChild(input);
  row.appendChild(submit);
  container.appendChild(label);
  container.appendChild(row);

  requestAnimationFrame(() => {
    input.focus();
  });

  return () => {
    input.removeEventListener("mousedown", onMouseDown);
    input.removeEventListener("keydown", onKeyDown);
    input.removeEventListener("paste", onPaste, true);
    input.removeEventListener("input", onInput);
    submit.removeEventListener("mousedown", onMouseDown);
    submit.removeEventListener("click", onSubmitClick);
  };
}

export const pageEditorSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    database: createMdxPlaceholderBlockSpec("database")(),
    unknown: createMdxPlaceholderBlockSpec("unknown")(),
    bookmark: createBookmarkBlockSpec()(),
    maps: createMapsBlockSpec()(),
  },
});

export type PageEditor = BlockNoteEditor<
  typeof pageEditorSchema.blockSchema,
  typeof pageEditorSchema.inlineContentSchema,
  typeof pageEditorSchema.styleSchema
>;
