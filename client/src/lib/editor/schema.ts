import {
  BlockNoteSchema,
  createBlockSpec,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  type BlockNoteEditor,
} from "@blocknote/core";
import { calloutBlock } from "./blocks/callout";
import { commitMapsUrl, mapsRawFromUrl } from "./blocks/maps";
import {
  databaseRawFromId,
  paintDatabaseError,
  paintDatabaseTable,
} from "../database/block";
import { fetchDatabaseDetail } from "../database/fetch";
import { dbMutedText, dbRoot } from "../database/ui";
import {
  bookmarkDisplayLabel,
  elementToMdxTag,
  googleMapsEmbedSrc,
  idAttrFromMdxRaw,
  mdxExportMarker,
  mdxTagWriteName,
  urlAttrFromMdxRaw,
  type MdxPlaceholderTag,
} from "./mdxPlaceholders";
import { openExternalUrl } from "../api/tauri";
import { bookmarkRawFromUrl } from "./blocks/bookmark";
import { pageLink } from "./pageLinkInline";
import { mentionDate } from "./mentionDateInline";
import { renderTocDom, tocDefaultRaw } from "./blocks/toc";

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

function parseDatabaseBlockProps(element: HTMLElement) {
  if (
    element.tagName === "DIV" &&
    element.getAttribute("data-content-type") === "database"
  ) {
    const fromAttr = element.getAttribute("data-raw");
    if (fromAttr) {
      return {
        raw: fromAttr,
        databaseId: idAttrFromMdxRaw(fromAttr),
      };
    }
  }

  if (element.tagName.toLowerCase() !== "database") {
    return undefined;
  }

  const raw = elementToMdxTag(element);
  return {
    raw,
    databaseId: element.getAttribute("id")?.trim() ?? idAttrFromMdxRaw(raw),
  };
}

function createMdxPlaceholderBlockSpec(tag: MdxPlaceholderTag) {
  const defaultRaw = `<${mdxTagWriteName(tag)} />`;

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
        return { dom: mdxExportMarker(tag, raw) };
      },
    },
  );
}

function createDatabaseBlockSpec() {
  return createBlockSpec(
    {
      type: "database",
      propSchema: {
        raw: {
          default: `<${mdxTagWriteName("database")} />`,
        },
        databaseId: {
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
        return parseDatabaseBlockProps(element);
      },
      render(block) {
        const databaseId =
          String(block.props.databaseId || "").trim() ||
          idAttrFromMdxRaw(String(block.props.raw));
        const { dom, destroy } = renderDatabaseDom(databaseId);
        dom.dataset.mdxTag = "database";
        dom.contentEditable = "false";
        return { dom, destroy };
      },
      toExternalHTML(block) {
        const databaseId =
          String(block.props.databaseId || "").trim() ||
          idAttrFromMdxRaw(String(block.props.raw));
        const raw = databaseRawFromId(databaseId, String(block.props.raw));
        return { dom: mdxExportMarker("database", raw) };
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
          default: `<${mdxTagWriteName("bookmark")} url="" />`,
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
        const raw = bookmarkRawFromUrl(url, String(block.props.raw));
        return { dom: mdxExportMarker("bookmark", raw) };
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
        const { dom, destroy, stopEvent, ignoreMutation } = renderMapsDom(
          url,
          {
            editable: editor.isEditable,
            onCommitUrl: (nextUrl) => commitMapsUrl(editor, block.id, nextUrl),
          },
        );
        dom.dataset.mdxTag = "maps";
        dom.contentEditable = "false";
        return { dom, destroy, stopEvent, ignoreMutation };
      },
      toExternalHTML(block) {
        const url =
          String(block.props.url || "").trim() ||
          urlAttrFromMdxRaw(String(block.props.raw));
        const raw = mapsRawFromUrl(url, String(block.props.raw));
        return { dom: mdxExportMarker("maps", raw) };
      },
    },
  );
}

function createTocBlockSpec() {
  return createBlockSpec(
    {
      type: "toc",
      propSchema: {
        raw: {
          default: tocDefaultRaw(),
        },
      },
      content: "none",
    },
    {
      meta: {
        selectable: true,
      },
      parse(element) {
        const parsed = parseMdxBlockProps("toc", element);
        if (!parsed) return undefined;
        return { raw: parsed.raw };
      },
      render(_block, editor) {
        const { dom, destroy, stopEvent, ignoreMutation } = renderTocDom(editor);
        dom.dataset.mdxTag = "toc";
        return { dom, destroy, stopEvent, ignoreMutation };
      },
      toExternalHTML(block) {
        const raw = String(block.props.raw) || tocDefaultRaw();
        return { dom: mdxExportMarker("toc", raw) };
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

type DatabaseRenderResult = {
  dom: HTMLElement;
  destroy?: () => void;
};

function renderDatabaseDom(databaseId: string): DatabaseRenderResult {
  const dom = document.createElement("div");
  dom.className = dbRoot;

  if (!databaseId) {
    paintDatabaseError(dom, "", "Database (missing id)");
    return { dom };
  }

  const body = document.createElement("div");
  body.className = dbMutedText;
  body.textContent = "Loading…";

  dom.appendChild(body);

  let cancelled = false;
  let destroyTable: (() => void) | undefined;

  void (async () => {
    try {
      const detail = await fetchDatabaseDetail(databaseId);
      if (cancelled) return;

      if (!detail) {
        paintDatabaseError(dom, databaseId, "Not found");
        return;
      }

      const painted = paintDatabaseTable(dom, detail);
      destroyTable = painted.destroy;
    } catch (error) {
      if (cancelled) return;
      paintDatabaseError(
        dom,
        databaseId,
        error instanceof Error ? error.message : "Failed to load database",
      );
    }
  })();

  return {
    dom,
    destroy: () => {
      cancelled = true;
      destroyTable?.();
    },
  };
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

type MapsRenderResult = {
  dom: HTMLElement;
  destroy?: () => void;
  /** Keep ProseMirror from handling keys/clicks inside the URL form. */
  stopEvent?: (event: Event) => boolean;
  ignoreMutation?: (mutation: { target: Node | null }) => boolean;
};

function renderMapsDom(
  url: string,
  options: MapsRenderOptions,
): MapsRenderResult {
  const dom = document.createElement("div");
  dom.className = "bn-mdx-maps";

  const embedSrc = url ? googleMapsEmbedSrc(url) : null;
  if (!embedSrc) {
    dom.classList.add("bn-mdx-maps--empty");

    if (!url && options.editable) {
      return {
        dom,
        destroy: mountMapsUrlInput(dom, options.onCommitUrl),
        // Without this, the first keypress is handled by the editor and the
        // node view remounts (BlockNote has no `update`), wiping the input.
        stopEvent: (event) => {
          const target = event.target;
          return target instanceof Node && dom.contains(target);
        },
        ignoreMutation: (mutation) => {
          return (
            mutation.target instanceof Node && dom.contains(mutation.target)
          );
        },
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

  // Capture-phase stop so ProseMirror never sees keys while the field is focused
  // (otherwise the first character replaces/removes the empty Maps block).
  const stopEditor = (event: Event) => {
    event.stopPropagation();
  };

  const onMouseDown = (event: MouseEvent) => {
    event.stopPropagation();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
  };

  const onPaste = (event: ClipboardEvent) => {
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

  const onInput = (event: Event) => {
    event.stopPropagation();
    setError(null);
  };

  input.addEventListener("mousedown", onMouseDown, true);
  input.addEventListener("keydown", onKeyDown, true);
  input.addEventListener("keyup", stopEditor, true);
  input.addEventListener("keypress", stopEditor, true);
  input.addEventListener("beforeinput", stopEditor, true);
  input.addEventListener("input", onInput, true);
  input.addEventListener("paste", onPaste, true);
  submit.addEventListener("mousedown", onMouseDown, true);
  submit.addEventListener("click", onSubmitClick);

  row.appendChild(input);
  row.appendChild(submit);
  container.appendChild(label);
  container.appendChild(row);

  requestAnimationFrame(() => {
    input.focus();
  });

  return () => {
    input.removeEventListener("mousedown", onMouseDown, true);
    input.removeEventListener("keydown", onKeyDown, true);
    input.removeEventListener("keyup", stopEditor, true);
    input.removeEventListener("keypress", stopEditor, true);
    input.removeEventListener("beforeinput", stopEditor, true);
    input.removeEventListener("input", onInput, true);
    input.removeEventListener("paste", onPaste, true);
    submit.removeEventListener("mousedown", onMouseDown, true);
    submit.removeEventListener("click", onSubmitClick);
  };
}

export const pageEditorSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    database: createDatabaseBlockSpec()(),
    unknown: createMdxPlaceholderBlockSpec("unknown")(),
    bookmark: createBookmarkBlockSpec()(),
    maps: createMapsBlockSpec()(),
    toc: createTocBlockSpec()(),
    callout: calloutBlock(),
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    pageLink,
    mentionDate,
  },
});

export type PageEditor = BlockNoteEditor<
  typeof pageEditorSchema.blockSchema,
  typeof pageEditorSchema.inlineContentSchema,
  typeof pageEditorSchema.styleSchema
>;
