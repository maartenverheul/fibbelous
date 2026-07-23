import { SideMenuExtension } from "@blocknote/core/extensions";
import {
  useBlockNoteEditor,
  useComponentsContext,
  useDictionary,
  useExtensionState,
} from "@blocknote/react";
import { useEffect, useState } from "react";
import { CALLOUT_COLORS } from "./calloutBlock";

const PICKER_COLORS = ["default", ...CALLOUT_COLORS] as const;

function CalloutColorSwatch({
  color,
  size = 18,
}: {
  color: (typeof PICKER_COLORS)[number];
  size?: number;
}) {
  return (
    <div
      className="bn-color-icon"
      data-background-color={color}
      style={{
        pointerEvents: "none",
        height: size,
        width: size,
        lineHeight: `${size}px`,
        fontSize: size * 0.75,
        textAlign: "center",
        ...(color !== "default"
          ? { backgroundColor: `var(--color-callout-${color})` }
          : {}),
      }}
      aria-hidden
    />
  );
}

/** Drag-handle submenu to set `<Callout color="…" />`. Only shown for callouts. */
export function CalloutColorItem({ children }: { children: string }) {
  const Components = useComponentsContext()!;
  const dict = useDictionary();
  const editor = useBlockNoteEditor<any, any, any>();

  const block = useExtensionState(SideMenuExtension, {
    editor,
    selector: (state) => state?.block,
  });

  const propColor =
    block?.type === "callout"
      ? String((block.props as { color?: string }).color ?? "").trim() ||
        "default"
      : "default";

  const [current, setCurrent] = useState(propColor);
  useEffect(() => {
    setCurrent(propColor);
  }, [propColor, block?.id]);

  if (block === undefined || block.type !== "callout") {
    return null;
  }

  return (
    <Components.Generic.Menu.Root position="right" sub>
      <Components.Generic.Menu.Trigger sub>
        <Components.Generic.Menu.Item className="bn-menu-item" subTrigger>
          {children}
        </Components.Generic.Menu.Item>
      </Components.Generic.Menu.Trigger>

      <Components.Generic.Menu.Dropdown
        sub
        className="bn-menu-dropdown bn-color-picker-dropdown"
      >
        <Components.Generic.Menu.Label>
          {dict.color_picker.background_title}
        </Components.Generic.Menu.Label>
        {PICKER_COLORS.map((color) => (
          <Components.Generic.Menu.Item
            key={color}
            className="bn-menu-item"
            icon={<CalloutColorSwatch color={color} />}
            checked={current === color}
            onClick={() => {
              const next = color === "default" ? "" : color;
              editor.updateBlock(block, {
                type: "callout",
                props: { color: next },
              });
              setCurrent(color);
            }}
          >
            {dict.color_picker.colors[color]}
          </Components.Generic.Menu.Item>
        ))}
      </Components.Generic.Menu.Dropdown>
    </Components.Generic.Menu.Root>
  );
}
