import { createReactBlockSpec } from "@blocknote/react";
import { EmojiIcon } from "../../../components/emoji/EmojiIcon";
import { EmojiIconPicker } from "../../../components/emoji/EmojiIconPicker";
import { cn } from "../../utils";

/** Default callout icon when none is specified. */
export const CALLOUT_DEFAULT_ICON = "💡";

/** BlockNote / Tailwind palette names accepted by `<Callout color="…" />`. */
export const CALLOUT_COLORS = [
  "gray",
  "brown",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
] as const;

export type CalloutColor = (typeof CALLOUT_COLORS)[number];

export function isCalloutColor(value: string): value is CalloutColor {
  return (CALLOUT_COLORS as readonly string[]).includes(value);
}

export function normalizeCalloutColor(value: string): CalloutColor | "" {
  const trimmed = value.trim().toLowerCase();
  return isCalloutColor(trimmed) ? trimmed : "";
}

type CalloutParseResult = {
  icon: string;
  color: string;
};

/** Read icon/color from a callout marker or `<callout>` element. */
export function parseCalloutBlockProps(
  element: HTMLElement,
): CalloutParseResult | undefined {
  if (
    element.tagName === "DIV" &&
    element.getAttribute("data-content-type") === "callout"
  ) {
    return {
      icon:
        element.getAttribute("data-icon")?.trim() || CALLOUT_DEFAULT_ICON,
      color: normalizeCalloutColor(
        element.getAttribute("data-color")?.trim() ?? "",
      ),
    };
  }

  if (element.tagName.toLowerCase() !== "callout") {
    return undefined;
  }

  return {
    icon: element.getAttribute("icon")?.trim() || CALLOUT_DEFAULT_ICON,
    color: normalizeCalloutColor(element.getAttribute("color")?.trim() ?? ""),
  };
}

export const calloutBlock = createReactBlockSpec(
  {
    type: "callout",
    propSchema: {
      icon: {
        default: CALLOUT_DEFAULT_ICON,
      },
      color: {
        default: "",
      },
    },
    content: "inline",
  } as const,
  {
    meta: {
      isolating: false,
    },
    parse: parseCalloutBlockProps,
    render: (props) => {
      const icon =
        String(props.block.props.icon ?? "").trim() || CALLOUT_DEFAULT_ICON;
      const color = normalizeCalloutColor(
        String(props.block.props.color ?? ""),
      );
      const editable = props.editor.isEditable;

      return (
        <div
          className="bn-mdx-callout"
          data-mdx-tag="callout"
          {...(color ? { "data-callout-color": color } : {})}
        >
          {editable ? (
            <EmojiIconPicker
              icon={icon}
              onSelect={(emoji) => {
                props.editor.updateBlock(props.block, {
                  type: "callout",
                  props: { icon: emoji },
                });
              }}
              className={cn(
                "bn-mdx-callout__icon-btn",
                "h-8 w-8 shrink-0 border-0 bg-transparent p-0",
                "hover:bg-black/5 dark:hover:bg-white/10",
              )}
            />
          ) : (
            <span className="bn-mdx-callout__icon" aria-hidden>
              <EmojiIcon icon={icon} size={20} />
            </span>
          )}
          <div className="bn-mdx-callout__content" ref={props.contentRef} />
        </div>
      );
    },
    toExternalHTML: (props) => {
      const icon =
        String(props.block.props.icon ?? "").trim() || CALLOUT_DEFAULT_ICON;
      const color = normalizeCalloutColor(
        String(props.block.props.color ?? ""),
      );

      return (
        <div
          data-content-type="callout"
          data-icon={icon}
          {...(color ? { "data-color": color } : {})}
        >
          <div className="bn-inline-content" ref={props.contentRef} />
        </div>
      );
    },
  },
);
