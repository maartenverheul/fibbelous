import { createReactInlineContentSpec } from "@blocknote/react";
import { useLayoutEffect, useRef, useState } from "react";
import { PiFileText } from "react-icons/pi";
import { EmojiIcon } from "../components/emoji/EmojiIcon";
import { useWorkspacePages } from "../hooks/useWorkspacePages";
import { cn } from "./utils";
import type { WorkspacePage } from "../types/page";
import { pageLabel } from "../types/page";
import { openWorkspacePage } from "./pageNavigate";
import { normalizePageHref, pageIdFromInternalLink } from "./pageLinks";

function parsePageLinkProps(element: HTMLElement) {
  const isMarker =
    element.getAttribute("data-inline-content-type") === "pageLink" ||
    element.getAttribute("data-content-type") === "pageLink";
  if (!isMarker) return undefined;

  const href =
    element.getAttribute("data-href")?.trim() ||
    element.getAttribute("href")?.trim() ||
    "";
  if (!href) return undefined;

  return {
    href,
    pageId:
      element.getAttribute("data-page-id")?.trim() ||
      pageIdFromInternalLink(href) ||
      "",
    name: element.getAttribute("data-name")?.trim() || href,
    icon: element.getAttribute("data-icon")?.trim() || "",
  };
}

function pageFromLinkProps(props: {
  href: string;
  pageId: string;
  name: string;
  icon: string;
}): WorkspacePage {
  const href = normalizePageHref(props.href);
  const id = props.pageId || pageIdFromInternalLink(href) || href;
  const stem = href.endsWith(".mdx")
    ? href.slice(href.lastIndexOf("/") + 1, -".mdx".length)
    : href.slice(href.lastIndexOf("/") + 1);
  const dash = stem.indexOf("-");
  const slug =
    dash > 0 && dash < stem.length - 1 ? stem.slice(dash + 1) : null;

  return {
    id,
    slug,
    title: props.name || null,
    icon: props.icon || null,
    path: href,
    hasChildren: false,
  };
}

function findInlineLine(anchor: HTMLElement): HTMLElement | null {
  return (
    anchor.closest(".bn-inline-content") ??
    anchor.closest(".bn-block-content")?.querySelector(".bn-inline-content") ??
    null
  );
}

/**
 * Solo (chip) when the row has no other text — only page links / whitespace.
 * Inline (link style) when the page link sits among other text on the row.
 */
function isSoloOnRow(anchor: HTMLElement): boolean | null {
  const line = findInlineLine(anchor);
  if (!line) return null;

  const clone = line.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(
      [
        "[data-inline-content-type='pageLink']",
        ".bn-ic-react-node-view-renderer",
        ".bn-page-link",
        "br",
        ".ProseMirror-trailingBreak",
      ].join(","),
    )
    .forEach((el) => el.remove());

  return !clone.textContent?.replace(/[\u200b\u00a0]/g, "").trim();
}

function PageLinkInline(props: {
  href: string;
  pageId: string;
  name: string;
  icon: string;
}) {
  const { findPageById } = useWorkspacePages();
  const anchorRef = useRef<HTMLAnchorElement>(null);
  // Prefer chip until we know the link is mid-sentence.
  const [solo, setSolo] = useState(true);
  const cached = props.pageId ? findPageById(props.pageId) : undefined;
  const page = cached ?? pageFromLinkProps(props);
  const label = cached ? pageLabel(cached) : props.name || pageLabel(page);
  const icon = cached?.icon ?? (props.icon || null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const update = () => {
      const next = isSoloOnRow(anchor);
      if (next !== null) setSolo(next);
    };

    update();
    const raf = requestAnimationFrame(update);

    const root = anchor.closest(".bn-editor") ?? anchor.ownerDocument.body;
    const observer = new MutationObserver(update);
    observer.observe(root, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [label, icon]);

  const navigate = () => openWorkspacePage(page);

  return (
    <a
      ref={anchorRef}
      href={normalizePageHref(props.href || page.path)}
      className={cn("bn-page-link", solo ? "bn-page-link--solo" : "bn-page-link--inline")}
      contentEditable={false}
      title={label}
      // ProseMirror consumes the first press on atom inline content for
      // selection/focus, so click alone needs a second tap. Prevent that on
      // pointerdown; navigate on pointerup. Keep click for keyboard (detail === 0).
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerUp={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        navigate();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.detail === 0) navigate();
      }}
    >
      <span className="bn-page-link__icon" aria-hidden>
        {icon ? (
          <EmojiIcon icon={icon} size={solo ? 15 : 14} />
        ) : (
          <PiFileText className="bn-page-link__fallback-icon" />
        )}
      </span>
      <span className="bn-page-link__name">{label}</span>
    </a>
  );
}

export const pageLink = createReactInlineContentSpec(
  {
    type: "pageLink",
    propSchema: {
      href: {
        default: "",
      },
      pageId: {
        default: "",
      },
      name: {
        default: "",
      },
      icon: {
        default: "",
      },
    },
    content: "none",
  } as const,
  {
    parse: parsePageLinkProps,
    render: (props) => {
      const { href, pageId, name, icon } = props.inlineContent.props;
      return (
        <PageLinkInline href={href} pageId={pageId} name={name} icon={icon} />
      );
    },
    toExternalHTML: (props) => {
      const { href, name, pageId, icon } = props.inlineContent.props;
      const page = pageFromLinkProps({ href, pageId, name, icon });
      const label = name || pageLabel(page);
      return <a href={normalizePageHref(href)}>{label}</a>;
    },
  },
);
