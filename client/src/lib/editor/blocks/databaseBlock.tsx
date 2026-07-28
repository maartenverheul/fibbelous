import { createReactBlockSpec } from "@blocknote/react";
import { DatabaseHost } from "../../../components/database/DatabaseHost";
import { databaseRawFromId } from "../../database/block";
import {
  elementToMdxTag,
  idAttrFromMdxRaw,
  mdxTagWriteName,
} from "../mdxPlaceholders";

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

export const databaseBlock = createReactBlockSpec(
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
  } as const,
  {
    meta: {
      selectable: true,
    },
    parse: parseDatabaseBlockProps,
    render: (props) => {
      const databaseId =
        String(props.block.props.databaseId || "").trim() ||
        idAttrFromMdxRaw(String(props.block.props.raw));

      return (
        <div
          className="bn-mdx-database min-w-0 max-w-full w-full overflow-hidden"
          data-mdx-tag="database"
          contentEditable={false}
        >
          <DatabaseHost databaseId={databaseId} variant="inline" />
        </div>
      );
    },
    toExternalHTML: (props) => {
      const databaseId =
        String(props.block.props.databaseId || "").trim() ||
        idAttrFromMdxRaw(String(props.block.props.raw));
      const raw = databaseRawFromId(databaseId, String(props.block.props.raw));

      return (
        <div
          data-content-type="database"
          data-raw={raw}
          {...(databaseId ? { id: databaseId } : {})}
        />
      );
    },
  },
);
