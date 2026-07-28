import { createReactInlineContentSpec } from "@blocknote/react";
import {
  formatMentionDate,
  formatMentionDateAbsolute,
  mentionDatePropsFromElement,
  type MentionDateProps,
} from "./mentionDate";

function parseMentionDateProps(element: HTMLElement) {
  const isMarker =
    element.getAttribute("data-inline-content-type") === "mentionDate" ||
    element.getAttribute("data-content-type") === "mentionDate";
  if (!isMarker) return undefined;

  const props = mentionDatePropsFromElement(element);
  if (!props) return undefined;
  return props;
}

function MentionDateInline(props: MentionDateProps) {
  const label = formatMentionDate(props);
  const absolute = formatMentionDateAbsolute(props);
  // Only tip when the visible label is relative (Today / Yesterday / …).
  const title = absolute && absolute !== label ? absolute : undefined;

  return (
    <span
      className="bn-mention-date"
      contentEditable={false}
      title={title}
    >
      <span className="bn-mention-date__at" aria-hidden>
        @
      </span>
      <span className="bn-mention-date__label">{label}</span>
    </span>
  );
}

export const mentionDate = createReactInlineContentSpec(
  {
    type: "mentionDate",
    propSchema: {
      start: {
        default: "",
      },
      startTime: {
        default: "",
      },
      timeZone: {
        default: "",
      },
    },
    content: "none",
  } as const,
  {
    parse: parseMentionDateProps,
    render: (props) => {
      const { start, startTime, timeZone } = props.inlineContent.props;
      return (
        <MentionDateInline
          start={start}
          startTime={startTime}
          timeZone={timeZone}
        />
      );
    },
    toExternalHTML: (props) => {
      const { start, startTime, timeZone } = props.inlineContent.props;
      const mentionProps = { start, startTime, timeZone };
      return (
        <span
          data-inline-content-type="mentionDate"
          data-start={start || undefined}
          data-start-time={startTime || undefined}
          data-time-zone={timeZone || undefined}
        >
          {formatMentionDate(mentionProps)}
        </span>
      );
    },
  },
);
