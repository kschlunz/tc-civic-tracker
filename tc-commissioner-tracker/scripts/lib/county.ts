/**
 * The county's own list of commissioner meetings at
 * https://www.transylvaniacounty.org/meetings — the source of truth for which
 * meetings exist and where their agenda, minutes and video live.
 */
import { MEETING_TYPES } from "../../src/lib/schema";

export const COUNTY_ORIGIN = "https://www.transylvaniacounty.org";
export const MEETINGS_URL = `${COUNTY_ORIGIN}/meetings`;
const USER_AGENT = "tc-civic-tracker (public meeting minutes archive; +https://github.com/kschlunz/tc-civic-tracker)";

export type MeetingType = (typeof MEETING_TYPES)[number];

export interface ListedMeeting {
  /** YYYY-MM-DD */
  date: string;
  title: string;
  type: MeetingType;
  /** e.g. "4:00 PM", or "" when the page gives none. */
  time: string;
  pageUrl: string;
  agendaUrl?: string;
  minutesUrl?: string;
  videoUrl?: string;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function absolute(href: string): string {
  return new URL(decodeEntities(href), COUNTY_ORIGIN).toString();
}

export function inferMeetingType(title: string): MeetingType {
  const t = title.toLowerCase();
  if (t.includes("organizational")) return "organizational";
  if (t.includes("workshop") || t.includes("retreat")) return "workshop";
  if (t.includes("special") || t.includes("joint") || t.includes("emergency")) return "special";
  return "regular";
}

function linkWithClass(row: string, className: string): string | undefined {
  const match = row.match(new RegExp(`<a href="([^"]+)" class="${className}"`));
  return match ? absolute(match[1]) : undefined;
}

/**
 * Parse one page of the meetings list. Dates come from the month heading and
 * the day badge on each row, which are the page's own statement of the date
 * (file names and page slugs occasionally contain typos).
 */
export function parseMeetingsPage(html: string): ListedMeeting[] {
  const meetings: ListedMeeting[] = [];
  let month: { year: number; month: number } | null = null;

  const tokens = html.split(/(?=<h3>[A-Za-z]+ \d{4}<\/h3>)|(?=<div class="meeting-listing views-row">)/);
  for (const token of tokens) {
    const heading = token.match(/^<h3>([A-Za-z]+) (\d{4})<\/h3>/);
    if (heading) {
      const index = MONTHS.indexOf(heading[1].toLowerCase());
      month = index >= 0 ? { year: Number(heading[2]), month: index + 1 } : null;
    }
    const rowStart = token.indexOf('<div class="meeting-listing views-row">');
    if (rowStart < 0) continue;
    const row = token.slice(rowStart).split('<nav class="pager"')[0];

    const day = row.match(/<div class="date-display"><p><span>(\d{1,2})<\/span>/);
    const title = row.match(/views-field-title"><span class="field-content"><a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!month || !day || !title) continue;

    const date = `${month.year}-${String(month.month).padStart(2, "0")}-${day[1].padStart(2, "0")}`;
    const titleText = decodeEntities(title[2].replace(/<[^>]+>/g, "")).trim();
    const time = row.match(/Time: ([^<]*)/)?.[1].trim() ?? "";

    meetings.push({
      date,
      title: titleText,
      type: inferMeetingType(titleText),
      time: time.replace(/\b(am|pm)\b/i, (m) => m.toUpperCase()),
      pageUrl: absolute(title[1]),
      agendaUrl: linkWithClass(row, "meeting-agenda-link"),
      minutesUrl: linkWithClass(row, "meeting-minutes-link"),
      videoUrl: linkWithClass(row, "meeting-video-link"),
    });
  }
  return meetings;
}

async function fetchWithRetry(url: string, attempts = 4): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(60_000) });
      if (response.ok) return response;
      lastError = new Error(`${url} responded ${response.status}`);
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000 * 2 ** i));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Every listed meeting on or after `since`, oldest first. The list is newest
 * first, so paging stops at the first page that is entirely older than `since`.
 */
export async function listMeetings(since: string, maxPages = 40): Promise<ListedMeeting[]> {
  const found: ListedMeeting[] = [];
  for (let page = 0; page < maxPages; page++) {
    const html = await (await fetchWithRetry(`${MEETINGS_URL}?page=${page}`)).text();
    const rows = parseMeetingsPage(html);
    if (rows.length === 0) {
      if (page === 0) throw new Error(`No meetings found on ${MEETINGS_URL} — the page layout may have changed.`);
      break;
    }
    found.push(...rows.filter((r) => r.date >= since));
    if (rows.every((r) => r.date < since)) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return found.sort((a, b) => a.date.localeCompare(b.date));
}

/** Download a minutes PDF, checking that it really is one. */
export async function downloadPdf(url: string): Promise<Buffer> {
  const bytes = Buffer.from(await (await fetchWithRetry(url)).arrayBuffer());
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error(`${url} is not a PDF`);
  return bytes;
}
