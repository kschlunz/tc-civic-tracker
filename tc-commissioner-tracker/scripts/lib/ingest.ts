/** Bring newly published minutes into src/data/meetings. */
import type { CommissionerRecord, StoredMeeting } from "../../src/lib/types";
import type { ListedMeeting } from "./county";
import { extractMeeting, type Llm } from "./extraction";
import { applyFollowUpUpdates, openFollowUpsBefore, undoFollowUpUpdatesFrom } from "./followups";

export interface IngestOptions {
  /** Ignore meetings before this date (YYYY-MM-DD). */
  since: string;
  /** Most meetings to process in one run. Ignored when `force` is set. */
  limit: number;
  /** Extract again even where a record exists, from `since` onward. */
  force: boolean;
  /** Only these dates, if given. */
  only?: string[];
}

export interface IngestedMeeting {
  meeting: StoredMeeting;
  revised: boolean;
  warnings: string[];
  followUpUpdates: { id: string; status: string; resolution: string; description: string }[];
}

export interface IngestPlan {
  /** Meetings to extract, oldest first. */
  toProcess: (ListedMeeting & { minutesUrl: string })[];
  /** Listed meetings whose minutes are not posted yet. */
  awaitingMinutes: ListedMeeting[];
  /** Meetings that cannot be processed, with the reason. */
  skipped: { meeting: ListedMeeting; reason: string }[];
  /** Missing meetings older than the newest stored one, left for a rebuild. */
  outOfOrder: ListedMeeting[];
}

/** Decide what to do with each listed meeting, without calling the model. */
export function planIngest(listed: ListedMeeting[], stored: StoredMeeting[], options: IngestOptions, today: string): IngestPlan {
  const storedIds = new Set(stored.map((m) => m.id));
  const newestStored = stored.map((m) => m.id).sort().at(-1) ?? "";
  const plan: IngestPlan = { toProcess: [], awaitingMinutes: [], skipped: [], outOfOrder: [] };
  const seenDates = new Set<string>();

  for (const meeting of [...listed].sort((a, b) => a.date.localeCompare(b.date))) {
    if (meeting.date < options.since || meeting.date > today) continue;
    if (options.only && !options.only.includes(meeting.date)) continue;
    if (seenDates.has(meeting.date)) {
      plan.skipped.push({ meeting, reason: "a second meeting on the same date; only one per date is tracked" });
      continue;
    }
    seenDates.add(meeting.date);
    if (storedIds.has(meeting.date) && !options.force) continue;
    if (!meeting.minutesUrl) {
      plan.awaitingMinutes.push(meeting);
      continue;
    }
    if (!/\.pdf($|\?)/i.test(meeting.minutesUrl)) {
      plan.skipped.push({ meeting, reason: "minutes are not a PDF" });
      continue;
    }
    if (!options.force && !options.only && meeting.date < newestStored) {
      plan.outOfOrder.push(meeting);
      continue;
    }
    plan.toProcess.push({ ...meeting, minutesUrl: meeting.minutesUrl });
  }

  if (!options.force) plan.toProcess = plan.toProcess.slice(0, options.limit);
  return plan;
}

/**
 * Extract the planned meetings in date order. Each one sees the follow-ups
 * still open after the meetings before it, which is why order matters.
 * `meetings` is updated in place; `save` is called for every record that changes.
 */
export async function runIngest(input: {
  plan: IngestPlan;
  meetings: StoredMeeting[];
  roster: CommissionerRecord[];
  options: IngestOptions;
  llm: Llm;
  model: string;
  downloadPdf: (url: string) => Promise<Buffer>;
  save: (meeting: StoredMeeting) => void;
  log?: (line: string) => void;
}): Promise<IngestedMeeting[]> {
  const { plan, meetings, roster, options, llm, model, downloadPdf, save } = input;
  const log = input.log ?? (() => {});
  const results: IngestedMeeting[] = [];

  if (options.force && plan.toProcess.length > 0) {
    undoFollowUpUpdatesFrom(meetings, plan.toProcess[0].date).forEach(save);
  }

  for (const listed of plan.toProcess) {
    log(`  ${listed.date} ${listed.title}`);
    const pdf = await downloadPdf(listed.minutesUrl);
    const openFollowUps = openFollowUpsBefore(meetings, listed.date);
    const result = await extractMeeting({ llm, model, pdf, listed, roster, openFollowUps });

    const existing = meetings.findIndex((m) => m.id === result.meeting.id);
    if (existing >= 0) meetings.splice(existing, 1);
    meetings.push(result.meeting);
    meetings.sort((a, b) => a.id.localeCompare(b.id));
    save(result.meeting);
    applyFollowUpUpdates(meetings, result.meeting.id, result.followUpUpdates).forEach(save);

    results.push({
      meeting: result.meeting,
      revised: result.revised,
      warnings: result.warnings,
      followUpUpdates: result.followUpUpdates.map((u) => ({
        ...u,
        description: openFollowUps.find((f) => f.id === u.id)?.description ?? "",
      })),
    });
  }
  return results;
}

/** Markdown summary for the pull request a reviewer reads. */
export function buildReport(results: IngestedMeeting[], plan: IngestPlan, model: string): string {
  const lines: string[] = [];
  lines.push(`Adds ${results.length} meeting${results.length === 1 ? "" : "s"} extracted from the county's official minutes by ${model}. Each record was checked against its PDF by a second pass; anything that pass was unsure about is listed under "To check".`, "");

  for (const { meeting, revised, warnings, followUpUpdates } of results) {
    const split = meeting.keyVotes.filter((v) => v.votes && v.votes.nays.length > 0);
    lines.push(`## ${meeting.date} — ${meeting.title ?? `${meeting.type} meeting`}`, "");
    lines.push(`[Minutes PDF](${meeting.sourceUrl}) · ${meeting.attendees.length} commissioners present · ${meeting.keyVotes.length} votes (${split.length} split) · ${meeting.publicComments.length} public comments · ${meeting.followUps.length} new follow-ups${revised ? " · revised once after review" : ""}`, "");
    lines.push(meeting.tldr, "");
    if (split.length > 0) {
      lines.push("**Split votes**", "");
      for (const v of split) lines.push(`- ${v.description} — ${v.result}, against: ${v.votes!.nays.join(", ")}${v.page ? ` (p. ${v.page})` : ""}`);
      lines.push("");
    }
    if (followUpUpdates.length > 0) {
      lines.push("**Earlier follow-ups updated**", "");
      for (const u of followUpUpdates) lines.push(`- \`${u.id}\` → ${u.status.replace("_", " ")}: ${u.description} — ${u.resolution}`);
      lines.push("");
    }
    if (warnings.length > 0) {
      lines.push("**To check**", "");
      for (const w of warnings) lines.push(`- ${w}`);
      lines.push("");
    } else {
      lines.push("No concerns raised by the automated review.", "");
    }
  }

  if (plan.outOfOrder.length > 0) {
    lines.push("## Not processed", "", `These meetings are older than the newest one already in the record, so adding them now would leave follow-up tracking out of order: ${plan.outOfOrder.map((m) => m.date).join(", ")}. Run the "Rebuild" option of the ingest workflow (or \`npm run ingest -- --force --since <date>\`) to bring them in.`, "");
  }
  if (plan.skipped.length > 0) {
    lines.push("## Skipped", "");
    for (const s of plan.skipped) lines.push(`- ${s.meeting.date} ${s.meeting.title}: ${s.reason}`);
    lines.push("");
  }
  if (plan.awaitingMinutes.length > 0) {
    lines.push(`Minutes not yet posted for: ${plan.awaitingMinutes.map((m) => m.date).join(", ")}.`, "");
  }
  return lines.join("\n");
}
