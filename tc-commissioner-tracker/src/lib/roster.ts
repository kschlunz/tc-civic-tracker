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

/** Elected but not yet sworn in: no term has started by the given date. */
export function electOn(record: CommissionerRecord, date: string): boolean {
  return record.terms.every((t) => t.start > date);
}

/** Leadership role held on the given date, "Commissioner", "Commissioner-elect" or "Former Commissioner". */
export function roleOn(record: CommissionerRecord, date: string): string {
  if (electOn(record, date)) return "Commissioner-elect";
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

/** Everyone in the roster in roster order: sitting members, then commissioners-elect, then former members. */
export function buildRoster(records: CommissionerRecord[], date: string): Commissioner[] {
  const rank = (r: CommissionerRecord) => (seatedOn(r, date) ? 0 : electOn(r, date) ? 1 : 2);
  return [...records]
    .map((r, i) => ({ r, i }))
    .sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i)
    .map(({ r }) => toCommissioner(r, date));
}
