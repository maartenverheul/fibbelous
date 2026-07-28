import { filterSuggestionItems } from "@blocknote/core/extensions";
import type { DefaultReactSuggestionItem } from "@blocknote/react";
import { PiCalendarBlank, PiFileText } from "react-icons/pi";
import { EmojiIcon } from "../../components/emoji/EmojiIcon";
import {
  pageLabel,
  type SearchPageHit,
  type WorkspacePage,
} from "../page/types";
import {
  civilDateYmd,
  nextWeekdayYmd,
  normalizeStartTime,
  parseHm,
  resolveMonthYm,
  resolveYearStart,
  shiftCivilDateYmd,
} from "./mentionDate";
import { pageLinkFilename } from "./pageLinks";
import type { PageEditor } from "./schema";

type MentionMenuOptions = {
  searchPages: (query: string) => Promise<SearchPageHit[]>;
  /** Shown when the query is empty (favorites preferred, else roots). */
  getSuggestedPages: () => WorkspacePage[];
};

const WEEKDAYS: { title: string; aliases: string[]; jsDay: number }[] = [
  { title: "Sunday", aliases: ["sun", "sunday"], jsDay: 0 },
  { title: "Monday", aliases: ["mon", "monday"], jsDay: 1 },
  { title: "Tuesday", aliases: ["tue", "tues", "tuesday"], jsDay: 2 },
  { title: "Wednesday", aliases: ["wed", "wednesday"], jsDay: 3 },
  { title: "Thursday", aliases: ["thu", "thur", "thurs", "thursday"], jsDay: 4 },
  { title: "Friday", aliases: ["fri", "friday"], jsDay: 5 },
  { title: "Saturday", aliases: ["sat", "saturday"], jsDay: 6 },
];

const MONTHS: { title: string; aliases: string[]; month: number }[] = [
  { title: "January", aliases: ["jan", "january"], month: 1 },
  { title: "February", aliases: ["feb", "february"], month: 2 },
  { title: "March", aliases: ["mar", "march"], month: 3 },
  { title: "April", aliases: ["apr", "april"], month: 4 },
  { title: "May", aliases: ["may"], month: 5 },
  { title: "June", aliases: ["jun", "june"], month: 6 },
  { title: "July", aliases: ["jul", "july"], month: 7 },
  { title: "August", aliases: ["aug", "august"], month: 8 },
  { title: "September", aliases: ["sep", "sept", "september"], month: 9 },
  { title: "October", aliases: ["oct", "october"], month: 10 },
  { title: "November", aliases: ["nov", "november"], month: 11 },
  { title: "December", aliases: ["dec", "december"], month: 12 },
];

/** Coerce typed time tokens (`14`, `14:`, `14:0`, `14:00`) to `HH:mm`. */
export function coerceMentionTime(timeToken: string): string {
  const trimmed = timeToken.trim();
  if (!trimmed) return "";

  if (parseHm(trimmed)) return normalizeStartTime(trimmed);

  const hourOnly = trimmed.match(/^(\d{1,2})$/);
  if (hourOnly) {
    const hour = Number(hourOnly[1]);
    if (hour >= 0 && hour <= 23) {
      return `${String(hour).padStart(2, "0")}:00`;
    }
    return "";
  }

  const hourColon = trimmed.match(/^(\d{1,2}):$/);
  if (hourColon) {
    const hour = Number(hourColon[1]);
    if (hour >= 0 && hour <= 23) {
      return `${String(hour).padStart(2, "0")}:00`;
    }
    return "";
  }

  // Still typing minutes — pad to two digits (`14:0` → `14:00`).
  const partialMinutes = trimmed.match(/^(\d{1,2}):(\d{1})$/);
  if (partialMinutes) {
    const hour = Number(partialMinutes[1]);
    const minute = Number(partialMinutes[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 9) {
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
  }

  return "";
}

/** Split `@today 14:00` into a date filter query and optional HH:mm. */
export function parseMentionQuery(query: string): {
  dateQuery: string;
  startTime: string;
  hasTimeToken: boolean;
} {
  // Last token looks like a (possibly partial) time: `14`, `14:`, `14:0`, `14:00`.
  const match = query.match(/^(.*?)\s+(\d{1,2}(?::\d{0,2})?)\s*$/);
  if (match && match[1].trim() !== "") {
    const timeToken = match[2];
    return {
      dateQuery: match[1].trim(),
      startTime: coerceMentionTime(timeToken),
      hasTimeToken: true,
    };
  }
  return {
    dateQuery: query.trim(),
    startTime: "",
    hasTimeToken: false,
  };
}

function insertMentionDate(
  editor: PageEditor,
  start: string,
  startTime = "",
) {
  editor.insertInlineContent([
    {
      type: "mentionDate",
      props: {
        start,
        startTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      },
    },
    " ",
  ]);
}

function insertPageMention(editor: PageEditor, page: WorkspacePage) {
  editor.insertInlineContent([
    {
      type: "pageLink",
      props: {
        href: pageLinkFilename(page.path),
        pageId: page.id,
        name: pageLabel(page),
        icon: page.icon ?? "",
      },
    },
    " ",
  ]);
}

function dateLabel(title: string, startTime: string): string {
  return startTime ? `${title} ${startTime}` : title;
}

function dateMentionItems(
  editor: PageEditor,
  startTime: string,
  includeExtended: boolean,
): DefaultReactSuggestionItem[] {
  const today = civilDateYmd();
  const currentYear = Number(today.slice(0, 4));

  const relative: DefaultReactSuggestionItem[] = [
    {
      title: dateLabel("Today", startTime),
      subtext: startTime ? `${today} ${startTime}` : today,
      aliases: ["today", "now"],
      group: "Date",
      icon: <PiCalendarBlank size={18} />,
      onItemClick: () => insertMentionDate(editor, today, startTime),
    },
    {
      title: dateLabel("Tomorrow", startTime),
      subtext: startTime
        ? `${shiftCivilDateYmd(today, 1)} ${startTime}`
        : shiftCivilDateYmd(today, 1),
      aliases: ["tomorrow"],
      group: "Date",
      icon: <PiCalendarBlank size={18} />,
      onItemClick: () =>
        insertMentionDate(editor, shiftCivilDateYmd(today, 1), startTime),
    },
    {
      title: dateLabel("Yesterday", startTime),
      subtext: startTime
        ? `${shiftCivilDateYmd(today, -1)} ${startTime}`
        : shiftCivilDateYmd(today, -1),
      aliases: ["yesterday"],
      group: "Date",
      icon: <PiCalendarBlank size={18} />,
      onItemClick: () =>
        insertMentionDate(editor, shiftCivilDateYmd(today, -1), startTime),
    },
  ];

  if (!includeExtended) return relative;

  const weekdays: DefaultReactSuggestionItem[] = WEEKDAYS.map((day) => {
    const start = nextWeekdayYmd(day.jsDay);
    return {
      title: dateLabel(day.title, startTime),
      subtext: startTime ? `${start} ${startTime}` : start,
      aliases: day.aliases,
      group: "Weekday",
      icon: <PiCalendarBlank size={18} />,
      onItemClick: () => insertMentionDate(editor, start, startTime),
    };
  });

  const months: DefaultReactSuggestionItem[] = MONTHS.map((month) => {
    const start = resolveMonthYm(month.month);
    return {
      title: dateLabel(month.title, startTime),
      subtext: startTime ? `${start} ${startTime}` : start,
      aliases: month.aliases,
      group: "Month",
      icon: <PiCalendarBlank size={18} />,
      onItemClick: () => insertMentionDate(editor, start, startTime),
    };
  });

  const years: DefaultReactSuggestionItem[] = [];
  for (let year = currentYear - 2; year <= currentYear + 3; year++) {
    const start = resolveYearStart(year);
    years.push({
      title: dateLabel(String(year), startTime),
      subtext: startTime ? `${start} ${startTime}` : start,
      aliases: [String(year)],
      group: "Year",
      icon: <PiCalendarBlank size={18} />,
      onItemClick: () => insertMentionDate(editor, start, startTime),
    });
  }

  return [...relative, ...weekdays, ...months, ...years];
}

/** If the query is a 4-digit year outside the static list, offer it too. */
function extraYearItems(
  editor: PageEditor,
  dateQuery: string,
  startTime: string,
  existing: DefaultReactSuggestionItem[],
): DefaultReactSuggestionItem[] {
  const match = dateQuery.trim().match(/^(\d{4})$/);
  if (!match) return [];
  const year = Number(match[1]);
  if (year < 1000 || year > 9999) return [];
  if (existing.some((item) => item.aliases?.includes(String(year)))) return [];

  const start = resolveYearStart(year);
  return [
    {
      title: dateLabel(String(year), startTime),
      subtext: startTime ? `${start} ${startTime}` : start,
      aliases: [String(year)],
      group: "Year",
      icon: <PiCalendarBlank size={18} />,
      onItemClick: () => insertMentionDate(editor, start, startTime),
    },
  ];
}

function pageToMentionItem(
  editor: PageEditor,
  page: WorkspacePage,
): DefaultReactSuggestionItem {
  const label = pageLabel(page);
  return {
    title: label,
    subtext: page.slug ?? undefined,
    aliases: [page.slug, page.id].filter(Boolean) as string[],
    group: "Pages",
    icon: page.icon ? (
      <EmojiIcon icon={page.icon} size={18} />
    ) : (
      <PiFileText size={18} />
    ),
    onItemClick: () => insertPageMention(editor, page),
  };
}

/**
 * `@` mention menu: relative dates, weekdays, months, years, plus pages.
 * Supports `@today 14:00` — trailing time is parsed and stored on the mention.
 */
export async function getMentionMenuItems(
  editor: PageEditor,
  query: string,
  options: MentionMenuOptions,
): Promise<DefaultReactSuggestionItem[]> {
  const { dateQuery, startTime, hasTimeToken } = parseMentionQuery(query);
  const allDates = dateMentionItems(editor, startTime, dateQuery.length > 0);
  const dates = [
    ...filterSuggestionItems(allDates, dateQuery),
    ...extraYearItems(editor, dateQuery, startTime, allDates),
  ];

  // Time suffix is for date mentions only — skip page search while typing a time.
  let pages: WorkspacePage[] = [];
  if (!hasTimeToken) {
    if (dateQuery) {
      try {
        pages = await options.searchPages(dateQuery);
      } catch (error) {
        console.error("Mention page search failed", error);
        pages = [];
      }
    } else {
      pages = options.getSuggestedPages();
    }
  }

  const seen = new Set<string>();
  const pageItems: DefaultReactSuggestionItem[] = [];
  for (const page of pages) {
    if (seen.has(page.id)) continue;
    seen.add(page.id);
    pageItems.push(pageToMentionItem(editor, page));
    if (pageItems.length >= 12) break;
  }

  return [...dates, ...pageItems];
}
