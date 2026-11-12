import type { Commissioner, CommissionerRecord } from "./types";

/** Today's date as YYYY-MM-DD in the county's time zone. */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
}

function inPeriod(period: { start: string; end?: string }, date: string): boolean {
  return period.start <= date && (period.end === undefined || date < period.end);
}

/** Was this person a sitting commissioner on the given date? */
export function seatedOn(record: CommissionerRecord, date: string): boolean {
  return record.terms.some((t) => inPeriod(t, date));
}

/** Leadership role held on the given date, or "Commissioner". */
export function roleOn(record: CommissionerRecord, date: string): string {
  if (!seatedOn(record, date)) return "Former Commissioner";
  return record.roles.find((r) => inPeriod(r, date))?.role ?? "Commissioner";
}

export function toCommissioner(record: CommissionerRecord, date: string): Commissioner {
  const current = seatedOn(record, date);
  return {
    id: record.id,
    name: record.name,
    color: record.color,
    since: record.since,
    role: roleOn(record, date),
    current,
    note: current ? record.note : undefined,
  };
}

/** Everyone in the roster, sitting members first, in roster order. */
export function buildRoster(records: CommissionerRecord[], date: string): Commissioner[] {
  const all = records.map((r) => toCommissioner(r, date));
  return [...all.filter((c) => c.current), ...all.filter((c) => !c.current)];
}
