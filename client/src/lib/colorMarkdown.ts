import type { Element, ElementContent, Properties, Root } from "hast";
import type { Html } from "mdast";
import { toHtml } from "hast-util-to-html";
import { defaultHandlers, type Handle, type State } from "hast-util-to-mdast";
import type { Plugin } from "unified";
import { COLORS_DEFAULT } from "@blocknote/core";

const COLOR_NAMES = Object.keys(COLORS_DEFAULT);

function normalizeColor(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function isColorName(value: string): boolean {
  return COLOR_NAMES.includes(value);
}

function isKnownColorName(value: string): boolean {
  return isColorName(value) || value === "white" || value === "black";
}

const TEXT_HEX_TO_NAME = new Map<string, string>([
  ...COLOR_NAMES.map(
    (name) =>
      [normalizeColor(COLORS_DEFAULT[name].text), name] as [string, string],
  ),
  [normalizeColor("#ffffff"), "white"],
  [normalizeColor("#000000"), "black"],
]);

const BG_HEX_TO_NAME = new Map<string, string>([
  ...COLOR_NAMES.map(
    (name) =>
      [
        normalizeColor(COLORS_DEFAULT[name].background),
        name,
      ] as [string, string],
  ),
  [normalizeColor("#ffffff"), "white"],
  [normalizeColor("#000000"), "black"],
]);

function propString(props: Properties | undefined, key: string): string {
  const value = props?.[key];
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.filter((part) => typeof part === "string").join(" ");
  }
  return "";
}

function cssStyle(props: Properties | undefined): string {
  return propString(props, "style");
}

function styleDeclares(
  style: string,
  property: "color" | "background-color",
): boolean {
  return new RegExp(`(?:^|;)\\s*${property}\\s*:`, "i").test(style);
}

function readStyleValue(
  style: string,
  property: "color" | "background-color",
): string {
  const match = style.match(
    new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i"),
  );
  return match?.[1]?.trim() ?? "";
}

/** Resolve a BlockNote palette name from a mark value or CSS color. */
export function resolveTextColorName(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "default") return undefined;
  if (isKnownColorName(trimmed)) return trimmed;
  return TEXT_HEX_TO_NAME.get(normalizeColor(trimmed));
}

export function resolveBgColorName(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "default") return undefined;
  if (isKnownColorName(trimmed)) return trimmed;
  return BG_HEX_TO_NAME.get(normalizeColor(trimmed));
}

type ColorAttrs = { fg?: string; bg?: string };

function colorsFromBlockNoteSpan(node: Element): ColorAttrs {
  const props = node.properties;
  const styleType = propString(props, "dataStyleType");
  const dataValue = propString(props, "dataValue");
  const style = cssStyle(props);
  const colors: ColorAttrs = {};

  if (styleType === "textColor") {
    colors.fg = resolveTextColorName(dataValue || readStyleValue(style, "color"));
  } else if (styleType === "backgroundColor") {
    colors.bg = resolveBgColorName(
      dataValue || readStyleValue(style, "background-color"),
    );
  } else {
    const fg = resolveTextColorName(readStyleValue(style, "color"));
    const bg = resolveBgColorName(readStyleValue(style, "background-color"));
    if (fg) colors.fg = fg;
    if (bg) colors.bg = bg;
  }

  return colors;
}

function colorsFromCompactClass(className: string): ColorAttrs {
  const colors: ColorAttrs = {};
  for (const token of className.split(/\s+/)) {
    if (token.startsWith("text-")) {
      const name = token.slice("text-".length);
      if (isKnownColorName(name)) colors.fg = name;
    } else if (token.startsWith("bg-")) {
      const name = token.slice("bg-".length);
      if (isKnownColorName(name)) colors.bg = name;
    }
  }
  return colors;
}

function colorsFromBlockElement(node: Element): ColorAttrs {
  const props = node.properties;
  const fromClass = colorsFromCompactClass(propString(props, "className"));
  const style = cssStyle(props);
  const colors: ColorAttrs = { ...fromClass };

  const dataFg = propString(props, "dataTextColor");
  const dataBg = propString(props, "dataBackgroundColor");
  if (dataFg) colors.fg = resolveTextColorName(dataFg) ?? colors.fg;
  if (dataBg) colors.bg = resolveBgColorName(dataBg) ?? colors.bg;

  const styleFg = resolveTextColorName(readStyleValue(style, "color"));
  const styleBg = resolveBgColorName(readStyleValue(style, "background-color"));
  if (styleFg) colors.fg = styleFg;
  if (styleBg) colors.bg = styleBg;

  return colors;
}

function isBlockNoteColorSpan(node: Element): boolean {
  if (node.tagName !== "span") return false;
  const props = node.properties;
  const styleType = propString(props, "dataStyleType");
  if (styleType === "textColor" || styleType === "backgroundColor") return true;
  const style = cssStyle(props);
  return (
    styleDeclares(style, "color") || styleDeclares(style, "background-color")
  );
}

function isCompactColorSpan(node: Element): boolean {
  if (node.tagName !== "span") return false;
  const { fg, bg } = colorsFromCompactClass(propString(node.properties, "className"));
  return Boolean(fg || bg);
}

function isColoredSpan(node: Element): boolean {
  return isBlockNoteColorSpan(node) || isCompactColorSpan(node);
}

function isColoredBlock(node: Element): boolean {
  const { fg, bg } = colorsFromBlockElement(node);
  return Boolean(fg || bg);
}

function colorClassName({ fg, bg }: ColorAttrs): string {
  const parts: string[] = [];
  if (bg) parts.push(`bg-${bg}`);
  if (fg) parts.push(`text-${fg}`);
  return parts.join(" ");
}

function mergeColors(a: ColorAttrs, b: ColorAttrs): ColorAttrs {
  return {
    fg: b.fg ?? a.fg,
    bg: b.bg ?? a.bg,
  };
}

/** Flatten nested BlockNote color spans into one compact class span. */
function compactColorSpan(node: Element): Element {
  let colors = colorsFromBlockNoteSpan(node);
  if (isCompactColorSpan(node)) {
    colors = mergeColors(colors, colorsFromCompactClass(propString(node.properties, "className")));
  }

  let children = node.children ?? [];

  // Unwrap nested color-only spans (BlockNote nests text + background marks).
  while (
    children.length === 1 &&
    children[0]?.type === "element" &&
    children[0].tagName === "span" &&
    isColoredSpan(children[0])
  ) {
    const inner = children[0];
    colors = mergeColors(colors, colorsFromBlockNoteSpan(inner));
    if (isCompactColorSpan(inner)) {
      colors = mergeColors(
        colors,
        colorsFromCompactClass(propString(inner.properties, "className")),
      );
    }
    children = inner.children ?? [];
  }

  children = children.map((child) =>
    child.type === "element" ? compactElementColors(child) : child,
  );

  const className = colorClassName(colors);
  if (!className) {
    return {
      ...node,
      children,
    };
  }

  return {
    type: "element",
    tagName: "span",
    properties: { className: className.split(/\s+/), },
    children,
  };
}

function stripColorStyles(style: string): string {
  return style
    .split(";")
    .map((part) => part.trim())
    .filter(
      (part) =>
        part &&
        !/^color\s*:/i.test(part) &&
        !/^background-color\s*:/i.test(part),
    )
    .join("; ");
}

function compactBlockElement(node: Element): Element {
  const colors = colorsFromBlockElement(node);
  const children = (node.children ?? []).map((child) =>
    child.type === "element" ? compactElementColors(child) : child,
  );

  const className = colorClassName(colors);
  if (!className) {
    return { ...node, children };
  }

  const props: Properties = { ...(node.properties ?? {}) };
  delete props.dataTextColor;
  delete props.dataBackgroundColor;
  delete props.style;

  const leftoverStyle = stripColorStyles(cssStyle(node.properties));
  if (leftoverStyle) props.style = leftoverStyle;

  const existing = propString(props, "className")
    .split(/\s+/)
    .filter(
      (token) =>
        token && !token.startsWith("text-") && !token.startsWith("bg-"),
    );
  props.className = [...existing, ...className.split(/\s+/)];

  return {
    ...node,
    properties: props,
    children,
  };
}

function compactElementColors(node: Element): Element {
  if (isColoredSpan(node)) {
    return compactColorSpan(node);
  }
  if (
    ["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "li"].includes(
      node.tagName,
    ) &&
    isColoredBlock(node)
  ) {
    return compactBlockElement(node);
  }

  return {
    ...node,
    children: (node.children ?? []).map((child) =>
      child.type === "element" ? compactElementColors(child) : child,
    ),
  };
}

function walkCompact(node: Root | Element): void {
  if (!node.children) return;
  node.children = node.children.map((child) => {
    if (child.type !== "element") return child;
    return compactElementColors(child);
  }) as ElementContent[];
}

/** Turn BlockNote color markup into `class="bg-yellow text-red"` spans/blocks. */
export const rehypeCompactColors: Plugin<[], Root> = () => {
  return (tree) => {
    walkCompact(tree);
  };
};

function textCss(name: string): string | undefined {
  if (name in COLORS_DEFAULT) return COLORS_DEFAULT[name].text;
  if (name === "white") return "#ffffff";
  if (name === "black") return "#000000";
  return undefined;
}

function bgCss(name: string): string | undefined {
  if (name in COLORS_DEFAULT) return COLORS_DEFAULT[name].background;
  if (name === "white") return "#ffffff";
  if (name === "black") return "#000000";
  return undefined;
}

/** Expand compact color classes back to BlockNote-parseable markup. */
function expandCompactSpan(node: Element): Element {
  const colors = colorsFromCompactClass(propString(node.properties, "className"));
  const children = (node.children ?? []).map((child) =>
    child.type === "element" ? expandElementColors(child) : child,
  );

  if (!colors.fg && !colors.bg) {
    return { ...node, children };
  }

  let current: ElementContent[] = children;

  if (colors.bg) {
    const background = bgCss(colors.bg);
    current = [
      {
        type: "element",
        tagName: "span",
        properties: {
          dataStyleType: "backgroundColor",
          dataValue: colors.bg,
          ...(background ? { style: `background-color: ${background}` } : {}),
        },
        children: current,
      },
    ];
  }

  if (colors.fg) {
    const color = textCss(colors.fg);
    current = [
      {
        type: "element",
        tagName: "span",
        properties: {
          dataStyleType: "textColor",
          dataValue: colors.fg,
          ...(color ? { style: `color: ${color}` } : {}),
        },
        children: current,
      },
    ];
  }

  // Single expanded root (caller replaces the compact span).
  return current[0] as Element;
}

function expandCompactBlock(node: Element): Element {
  const colors = colorsFromCompactClass(propString(node.properties, "className"));
  const children = (node.children ?? []).map((child) =>
    child.type === "element" ? expandElementColors(child) : child,
  );

  if (!colors.fg && !colors.bg) {
    return { ...node, children };
  }

  const props: Properties = { ...(node.properties ?? {}) };
  const leftover = propString(props, "className")
    .split(/\s+/)
    .filter(
      (token) =>
        token && !token.startsWith("text-") && !token.startsWith("bg-"),
    );

  if (leftover.length > 0) props.className = leftover;
  else delete props.className;

  const styleParts: string[] = [];
  const existingStyle = stripColorStyles(cssStyle(props));
  if (existingStyle) styleParts.push(existingStyle);

  if (colors.fg) {
    props.dataTextColor = colors.fg;
    const color = textCss(colors.fg);
    if (color) styleParts.push(`color: ${color}`);
  }
  if (colors.bg) {
    props.dataBackgroundColor = colors.bg;
    const background = bgCss(colors.bg);
    if (background) styleParts.push(`background-color: ${background}`);
  }

  if (styleParts.length > 0) props.style = styleParts.join("; ");
  else delete props.style;

  return { ...node, properties: props, children };
}

function expandElementColors(node: Element): Element {
  if (node.tagName === "span" && isCompactColorSpan(node)) {
    return expandCompactSpan(node);
  }

  const compact = colorsFromCompactClass(
    propString(node.properties, "className"),
  );
  if (
    ["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "li"].includes(
      node.tagName,
    ) &&
    (compact.fg || compact.bg)
  ) {
    return expandCompactBlock(node);
  }

  return {
    ...node,
    children: (node.children ?? []).map((child) =>
      child.type === "element" ? expandElementColors(child) : child,
    ),
  };
}

function walkExpand(node: Root | Element): void {
  if (!node.children) return;
  node.children = node.children.map((child) => {
    if (child.type !== "element") return child;
    return expandElementColors(child);
  }) as ElementContent[];
}

/** Expand `class="bg-* text-*"` color markup for BlockNote HTML import. */
export const rehypeExpandColors: Plugin<[], Root> = () => {
  return (tree) => {
    walkExpand(tree);
  };
};

function keepAsHtml(state: State, node: Element): Html {
  const result: Html = { type: "html", value: toHtml(node) };
  state.patch(node, result);
  return result;
}

function wrapBlockHandler(tag: keyof typeof defaultHandlers): Handle {
  const fallback = defaultHandlers[tag] as Handle;
  return (state, node, parent) => {
    if (isColoredBlock(node)) {
      return keepAsHtml(state, node);
    }
    return fallback(state, node, parent);
  };
}

function listHasColoredItem(node: Element): boolean {
  return (node.children ?? []).some(
    (child) =>
      child.type === "element" &&
      child.tagName === "li" &&
      isColoredBlock(child),
  );
}

function wrapListHandler(tag: "ul" | "ol"): Handle {
  const fallback = defaultHandlers[tag] as Handle;
  return (state, node, parent) => {
    if (listHasColoredItem(node)) {
      return keepAsHtml(state, node);
    }
    return fallback(state, node, parent);
  };
}

/**
 * Keep compact color spans/blocks as raw HTML in markdown
 * (`<span class="bg-yellow text-red">…</span>`).
 */
export const colorPreserveHandlers: Record<string, Handle> = {
  span(state, node) {
    if (isColoredSpan(node)) {
      return keepAsHtml(state, node);
    }
    return state.all(node);
  },
  p: wrapBlockHandler("p"),
  h1: wrapBlockHandler("h1"),
  h2: wrapBlockHandler("h2"),
  h3: wrapBlockHandler("h3"),
  h4: wrapBlockHandler("h4"),
  h5: wrapBlockHandler("h5"),
  h6: wrapBlockHandler("h6"),
  blockquote: wrapBlockHandler("blockquote"),
  ul: wrapListHandler("ul"),
  ol: wrapListHandler("ol"),
};
