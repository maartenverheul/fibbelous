/** Props stored on the mentionDate inline node / `<MentionDate />` MDX tag. */
export type MentionDateProps = {
  start: string;
  startTime: string;
  timeZone: string;
};

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const YM_RE = /^(\d{4})-(\d{2})$/;
const Y_RE = /^(\d{4})$/;
const HM_RE = /^(\d{1,2}):(\d{2})$/;

export type ParsedStart =
  | { precision: "day"; year: number; month: number; day: number }
  | { precision: "month"; year: number; month: number }
  | { precision: "year"; year: number };

/** Match `<MentionDate … />` or `<MentionDate …></MentionDate>` (any casing). */
export const MENTION_DATE_TAG_RE =
  /<MentionDate(\s[^>]*?)?\s*(?:\/>|><\/MentionDate>)/gi;

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function unescapeHtmlAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function parseAttrChunk(attrChunk: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRe =
    /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let attrMatch: RegExpExecArray | null;
  while ((attrMatch = attrRe.exec(attrChunk)) !== null) {
    const name = attrMatch[1];
    if (!name || name === "/") continue;
    attrs[name.toLowerCase()] =
      attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";
  }
  return attrs;
}

function isValidYmd(year: number, month: number, day: number): boolean {
  if (!Number.isFinite(year) || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/** Parse `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`. */
export function parseStart(value: string): ParsedStart | null {
  const trimmed = value.trim();

  const dayMatch = trimmed.match(YMD_RE);
  if (dayMatch) {
    const year = Number(dayMatch[1]);
    const month = Number(dayMatch[2]);
    const day = Number(dayMatch[3]);
    if (!isValidYmd(year, month, day)) return null;
    return { precision: "day", year, month, day };
  }

  const monthMatch = trimmed.match(YM_RE);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    if (!Number.isFinite(year) || month < 1 || month > 12) return null;
    return { precision: "month", year, month };
  }

  const yearMatch = trimmed.match(Y_RE);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    if (!Number.isFinite(year) || year < 1000 || year > 9999) return null;
    return { precision: "year", year };
  }

  return null;
}

/** Day-only parse (`YYYY-MM-DD`). Prefer `parseStart` for year/month forms. */
export function parseYmd(
  value: string,
): { year: number; month: number; day: number } | null {
  const parsed = parseStart(value);
  if (!parsed || parsed.precision !== "day") return null;
  return { year: parsed.year, month: parsed.month, day: parsed.day };
}

export function parseHm(
  value: string,
): { hour: number; minute: number } | null {
  const match = value.trim().match(HM_RE);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export function normalizeStartTime(value: string): string {
  const parsed = parseHm(value);
  if (!parsed) return value.trim();
  return `${String(parsed.hour).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")}`;
}

export function hasMentionDateValue(props: MentionDateProps): boolean {
  return Boolean(props.start.trim() || props.startTime.trim());
}

export function mentionDatePropsFromAttrs(
  attrs: Record<string, string>,
): MentionDateProps | null {
  const start = (attrs.start ?? "").trim();
  const startTime = (attrs.starttime ?? attrs["start-time"] ?? "").trim();
  const timeZone = (attrs.timezone ?? attrs["time-zone"] ?? "").trim();
  if (!start && !startTime) return null;
  if (start && !parseStart(start)) return null;
  if (startTime && !parseHm(startTime)) return null;
  return {
    start,
    startTime: startTime ? normalizeStartTime(startTime) : "",
    timeZone,
  };
}

export function mentionDatePropsFromElement(
  element: HTMLElement,
): MentionDateProps | null {
  return mentionDatePropsFromAttrs({
    start:
      element.getAttribute("data-start") ??
      element.getAttribute("start") ??
      "",
    starttime:
      element.getAttribute("data-start-time") ??
      element.getAttribute("startTime") ??
      element.getAttribute("starttime") ??
      "",
    timezone:
      element.getAttribute("data-time-zone") ??
      element.getAttribute("timeZone") ??
      element.getAttribute("timezone") ??
      "",
  });
}

/** Serialize props back to a canonical `<MentionDate … />` tag. */
export function buildMentionDateTag(props: MentionDateProps): string {
  const attrs: string[] = [];
  if (props.start.trim()) {
    attrs.push(`start="${escapeHtmlAttr(props.start.trim())}"`);
  }
  if (props.startTime.trim()) {
    attrs.push(
      `startTime="${escapeHtmlAttr(normalizeStartTime(props.startTime))}"`,
    );
  }
  if (props.timeZone.trim()) {
    attrs.push(`timeZone="${escapeHtmlAttr(props.timeZone.trim())}"`);
  }
  const attrStr = attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
  return `<MentionDate${attrStr} />`;
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: string;
};

function getZonedParts(date: Date, timeZone?: string): ZonedParts {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "long",
    hourCycle: "h23",
  };
  if (timeZone) options.timeZone = timeZone;

  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", options).formatToParts(date);
  } catch {
    // Invalid IANA zone — fall back to local.
    parts = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "long",
      hourCycle: "h23",
    }).formatToParts(date);
  }

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: get("weekday"),
  };
}

function dayNumber(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function formatTimeLabel(startTime: string): string {
  return normalizeStartTime(startTime);
}

function formatMonthName(month: number, style: "long" | "short" = "long"): string {
  return new Intl.DateTimeFormat("en-US", {
    month: style,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, month - 1, 1)));
}

function formatAbsoluteDate(
  ymd: { year: number; month: number; day: number },
  startTime: string,
): string {
  const instant = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day));
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(instant);

  if (!startTime.trim()) return dateLabel;
  return `${dateLabel} ${formatTimeLabel(startTime)}`;
}

function formatParsedStart(
  parsed: ParsedStart,
  startTime: string,
  now: Date,
  timeZone?: string,
): string {
  const timeSuffix = startTime ? ` ${formatTimeLabel(startTime)}` : "";
  const today = getZonedParts(now, timeZone);

  if (parsed.precision === "year") {
    const diff = parsed.year - today.year;
    if (diff === 0) return `This year${timeSuffix}`;
    if (diff === -1) return `Last year${timeSuffix}`;
    if (diff === 1) return `Next year${timeSuffix}`;
    return `${parsed.year}${timeSuffix}`;
  }

  if (parsed.precision === "month") {
    const diff =
      (parsed.year - today.year) * 12 + (parsed.month - today.month);
    if (diff === 0) return `This month${timeSuffix}`;
    if (diff === -1) return `Last month${timeSuffix}`;
    if (diff === 1) return `Next month${timeSuffix}`;
    const name = formatMonthName(parsed.month);
    if (parsed.year === today.year) return `${name}${timeSuffix}`;
    return `${name} ${parsed.year}${timeSuffix}`;
  }

  const diff =
    dayNumber(parsed.year, parsed.month, parsed.day) -
    dayNumber(today.year, today.month, today.day);

  if (diff === 0) return `Today${timeSuffix}`;
  if (diff === -1) return `Yesterday${timeSuffix}`;
  if (diff === 1) return `Tomorrow${timeSuffix}`;

  if (diff >= -6 && diff <= 6) {
    const weekday = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)));
    return `${weekday}${timeSuffix}`;
  }

  return formatAbsoluteDate(parsed, startTime);
}

function formatParsedStartAbsolute(
  parsed: ParsedStart,
  startTime: string,
): string {
  const timeSuffix = startTime ? ` ${formatTimeLabel(startTime)}` : "";

  if (parsed.precision === "year") {
    return `${parsed.year}${timeSuffix}`;
  }
  if (parsed.precision === "month") {
    return `${formatMonthName(parsed.month)} ${parsed.year}${timeSuffix}`;
  }
  return formatAbsoluteDate(parsed, startTime);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `YYYY-MM-DD` for `date`'s calendar day in `timeZone` (or local). */
export function civilDateYmd(date: Date = new Date(), timeZone?: string): string {
  const parts = getZonedParts(date, timeZone);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

/** Shift a civil `YYYY-MM-DD` by `deltaDays` (calendar arithmetic, not DST-sensitive). */
export function shiftCivilDateYmd(start: string, deltaDays: number): string {
  const ymd = parseYmd(start);
  if (!ymd) return start;
  const utc = Date.UTC(ymd.year, ymd.month - 1, ymd.day) + deltaDays * 86_400_000;
  const d = new Date(utc);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

const WEEKDAY_NAME_TO_JS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

function jsWeekdayInZone(date: Date, timeZone?: string): number {
  const name = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    ...(timeZone ? { timeZone } : {}),
  })
    .format(date)
    .toLowerCase();
  return WEEKDAY_NAME_TO_JS[name] ?? 0;
}

/** Next occurrence of a weekday (`Date#getDay` index), including today. */
export function nextWeekdayYmd(
  jsDay: number,
  now: Date = new Date(),
  timeZone?: string,
): string {
  const todayJs = jsWeekdayInZone(now, timeZone);
  const delta = (jsDay - todayJs + 7) % 7;
  return shiftCivilDateYmd(civilDateYmd(now, timeZone), delta);
}

/**
 * Upcoming month as `YYYY-MM` (this year if month is still ahead or current,
 * otherwise next year).
 */
export function resolveMonthYm(
  month: number,
  now: Date = new Date(),
  timeZone?: string,
): string {
  const parts = getZonedParts(now, timeZone);
  const year = month < parts.month ? parts.year + 1 : parts.year;
  return `${year}-${pad2(month)}`;
}

export function resolveYearStart(year: number): string {
  return String(year);
}

/**
 * Always-absolute label (for tooltips when the visible text is relative).
 */
export function formatMentionDateAbsolute(props: MentionDateProps): string {
  const start = props.start.trim();
  const startTime = props.startTime.trim();

  if (!start && !startTime) return "";
  if (!start) return formatTimeLabel(startTime);

  const parsed = parseStart(start);
  if (!parsed) {
    return startTime ? `${start} ${formatTimeLabel(startTime)}` : start;
  }
  return formatParsedStartAbsolute(parsed, startTime);
}

/**
 * Human-friendly label: Today / Yesterday / Tomorrow / weekday when close,
 * This month / This year, otherwise absolute. Appends time when set.
 *
 * `timeZone` only affects which calendar day/month/year "now" falls on.
 */
export function formatMentionDate(
  props: MentionDateProps,
  now: Date = new Date(),
): string {
  const start = props.start.trim();
  const startTime = props.startTime.trim();
  const timeZone = props.timeZone.trim() || undefined;

  if (!start && !startTime) return "Date";
  if (!start) return formatTimeLabel(startTime);

  const parsed = parseStart(start);
  if (!parsed) {
    return startTime ? `${start} ${formatTimeLabel(startTime)}` : start;
  }

  return formatParsedStart(parsed, startTime, now, timeZone);
}

/**
 * Rewrite `<MentionDate … />` in markdown to closed span markers before HTML5
 * parsing (self-closing custom tags would otherwise swallow siblings).
 */
export function mentionDateTagsToMarkers(markdown: string): string {
  if (!/MentionDate/i.test(markdown)) return markdown;

  MENTION_DATE_TAG_RE.lastIndex = 0;
  return markdown.replace(MENTION_DATE_TAG_RE, (_match, attrChunk: string) => {
    const props = mentionDatePropsFromAttrs(parseAttrChunk(attrChunk ?? ""));
    if (!props) return _match;

    const attrs = [
      `data-inline-content-type="mentionDate"`,
      props.start ? `data-start="${escapeHtmlAttr(props.start)}"` : "",
      props.startTime
        ? `data-start-time="${escapeHtmlAttr(props.startTime)}"`
        : "",
      props.timeZone
        ? `data-time-zone="${escapeHtmlAttr(props.timeZone)}"`
        : "",
    ]
      .filter(Boolean)
      .join(" ");

    return `<span ${attrs}></span>`;
  });
}

/**
 * Turn exported mentionDate nodes into inline MDX export carriers so remark
 * round-trips keep `<MentionDate … />` with exact attr casing.
 */
export function mentionDateMarkersToMdxTags(html: string): string {
  if (!html.includes("mentionDate") && !html.includes("MentionDate")) {
    return html;
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  const nodes = [
    ...doc.body.querySelectorAll(
      '[data-inline-content-type="mentionDate"], .bn-mention-date',
    ),
  ];
  if (nodes.length === 0) return html;

  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue;
    const props = mentionDatePropsFromElement(node);
    if (!props) continue;

    const carrier = doc.createElement("span");
    carrier.setAttribute("data-mdx-export-inline", "");
    carrier.textContent = buildMentionDateTag(props);
    node.replaceWith(carrier);
  }

  return doc.body.innerHTML;
}

export { unescapeHtmlAttr };
