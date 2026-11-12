/** Deciding which newly found public statements to keep. No model involved. */
import type { StoredStatement } from "../../src/lib/types";

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    return u.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export interface MergeResult {
  merged: StoredStatement[];
  added: StoredStatement[];
  rejected: { statement: StoredStatement; reason: string }[];
}

/**
 * Add found statements to the existing list. A statement is kept only if it
 * names a known commissioner, falls inside the search window, is not already
 * recorded, and (when `searchedUrls` is given) links to a page the search
 * actually returned, which rules out invented links.
 */
export function mergeStatements(input: {
  existing: StoredStatement[];
  found: StoredStatement[];
  commissionerIds: string[];
  since: string;
  today: string;
  searchedUrls?: string[];
}): MergeResult {
  const { existing, found, commissionerIds, since, today } = input;
  const searched = input.searchedUrls ? new Set(input.searchedUrls.map(normalizeUrl)) : null;
  const seen = new Set(existing.map((s) => `${s.commissionerId}|${s.url ? normalizeUrl(s.url) : `${s.date}|${s.source}`}`));
  const added: StoredStatement[] = [];
  const rejected: MergeResult["rejected"] = [];

  for (const statement of found) {
    const key = `${statement.commissionerId}|${statement.url ? normalizeUrl(statement.url) : `${statement.date}|${statement.source}`}`;
    let reason: string | null = null;
    if (!commissionerIds.includes(statement.commissionerId)) reason = "unknown commissioner";
    else if (!statement.url) reason = "no link to the source";
    else if (statement.date < since || statement.date > today) reason = `dated outside ${since} to ${today}`;
    else if (seen.has(key)) reason = "already recorded";
    else if (searched && !searched.has(normalizeUrl(statement.url))) reason = "link was not among the search results";

    if (reason) {
      if (reason !== "already recorded") rejected.push({ statement, reason });
      continue;
    }
    seen.add(key);
    added.push(statement);
  }
  return { merged: [...existing, ...added], added, rejected };
}

/** Start of the window to search: two weeks before the newest recorded news item. */
export function searchWindowStart(existing: StoredStatement[], today: string, maxDays = 90): string {
  const shift = (date: string, days: number) => {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const newest = existing.filter((s) => s.type === "news").map((s) => s.date).sort().at(-1);
  const floor = shift(today, -maxDays);
  if (!newest) return floor;
  const start = shift(newest, -14);
  return start < floor ? floor : start;
}
