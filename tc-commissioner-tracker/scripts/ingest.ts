/**
 * Find minutes the county has published that are not in the record yet and
 * add them.
 *
 *   npm run ingest                       # newly posted minutes (up to 3)
 *   npm run ingest -- --dry-run          # show what would be processed
 *   npm run ingest -- --date 2026-03-09  # one meeting
 *   npm run ingest -- --force --since 2024-12-02   # rebuild everything from a date
 *
 * Needs ANTHROPIC_API_KEY (except with --dry-run). Writes ingest-report.md,
 * which the scheduled workflow uses as the pull request description.
 */
import "./lib/env";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { todayISO } from "../src/lib/roster";
import { createClaudeLlm, resolveModel } from "./lib/claude";
import { downloadPdf, listMeetings } from "./lib/county";
import { buildReport, planIngest, runIngest, type IngestOptions } from "./lib/ingest";
import { ROOT, loadMeetings, loadRoster, saveMeeting } from "./lib/store";

/** The current board was seated at the organizational meeting on this date. */
const DEFAULT_SINCE = "2024-12-02";

const { values } = parseArgs({
  options: {
    since: { type: "string" },
    limit: { type: "string" },
    date: { type: "string", multiple: true },
    force: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
  },
});

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const since = values.since || process.env.TRACKER_SINCE || DEFAULT_SINCE;
const limit = Number(values.limit ?? 3);
for (const date of [since, ...(values.date ?? [])]) {
  if (!isoDate.test(date)) throw new Error(`"${date}" is not a YYYY-MM-DD date`);
}
if (!Number.isInteger(limit) || limit < 1) throw new Error("--limit must be a positive whole number");

const options: IngestOptions = { since, limit, force: values.force, only: values.date?.length ? values.date : undefined };

async function main() {
  const roster = loadRoster();
  const meetings = loadMeetings();
  console.log(`Checking the county meetings page for minutes since ${since}...`);
  const listed = await listMeetings(options.only ? [...options.only].sort()[0] : since);
  const plan = planIngest(listed, meetings, options, todayISO());

  console.log(`${listed.length} meetings listed, ${meetings.length} already in the record.`);
  if (plan.awaitingMinutes.length) console.log(`Minutes not yet posted: ${plan.awaitingMinutes.map((m) => m.date).join(", ")}`);
  if (plan.outOfOrder.length) console.log(`Older than the newest stored meeting (needs --force to rebuild): ${plan.outOfOrder.map((m) => m.date).join(", ")}`);
  for (const s of plan.skipped) console.log(`Skipping ${s.meeting.date}: ${s.reason}`);
  console.log(plan.toProcess.length ? `To process: ${plan.toProcess.map((m) => m.date).join(", ")}` : "Nothing new to process.");

  const reportFile = path.join(ROOT, "ingest-report.md");
  fs.rmSync(reportFile, { force: true });
  if (values["dry-run"] || plan.toProcess.length === 0) return;

  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env.local or the environment.");
  }
  const { llm, usage, model } = createClaudeLlm({ model: resolveModel() });
  const results = await runIngest({ plan, meetings, roster, options, llm, model, downloadPdf, save: saveMeeting, log: console.log });

  fs.writeFileSync(reportFile, buildReport(results, plan, model));
  const flagged = results.filter((r) => r.warnings.length > 0).length;
  console.log(`\nAdded ${results.length} meeting(s); ${flagged} with items to check. Report: ingest-report.md`);
  console.log(`Model usage: ${usage.requests} requests, ${usage.inputTokens} input tokens (+${usage.cachedInputTokens} cached), ${usage.outputTokens} output tokens.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
