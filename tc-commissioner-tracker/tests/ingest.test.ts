import assert from "node:assert/strict";
import { test } from "node:test";
import { extractMeeting } from "../scripts/lib/extraction";
import { buildReport, planIngest, runIngest, type IngestOptions } from "../scripts/lib/ingest";
import { StoredMeetingSchema } from "../src/lib/schema";
import type { StoredMeeting } from "../src/lib/types";
import { ROSTER, extraction, fakeLlm, listed, storedMeeting } from "./helpers";

const PDF = Buffer.from("%PDF-1.7 test");
const options = (overrides: Partial<IngestOptions> = {}): IngestOptions => ({ since: "2026-01-01", limit: 3, force: false, ...overrides });

test("extracts a meeting and builds the stored record from the listing", async () => {
  const { llm, calls } = fakeLlm({ extract: [extraction()] });
  const result = await extractMeeting({ llm, model: "test-model", pdf: PDF, listed: listed("2026-03-09", { videoUrl: "https://vimeo.com/event/1" }), roster: ROSTER, openFollowUps: [] });

  assert.deepEqual(calls.map((c) => c.task), ["extract", "review"]);
  assert.equal(result.revised, false);
  assert.deepEqual(result.warnings, []);
  StoredMeetingSchema.parse(result.meeting);

  const { meeting } = result;
  assert.equal(meeting.id, "2026-03-09");
  assert.equal(meeting.sourceUrl, listed("2026-03-09").minutesUrl);
  assert.equal(meeting.videoUrl, "https://vimeo.com/event/1");
  assert.equal(meeting.keyVotes[0].result, "2-1");
  assert.deepEqual(meeting.keyVotes[0].votes?.nays, ["mccall"]);
  assert.deepEqual(meeting.followUps.map((f) => [f.id, f.status, f.relatedMeetingId]), [["2026-03-09-fu-1", "open", "2026-03-09"]]);
  assert.equal(meeting.extraction?.model, "test-model");
});

test("only commissioners seated on the meeting date are offered to the model", async () => {
  const { llm, calls } = fakeLlm({ extract: [extraction({ attendees: ["mccall", "chapman"], keyVotes: [], commissionerActivity: [] })] });
  await extractMeeting({ llm, model: "m", pdf: PDF, listed: listed("2027-01-11"), roster: ROSTER, openFollowUps: [] });
  assert.match(calls[0].system, /mccall: Teresa McCall/);
  assert.doesNotMatch(calls[0].system, /dalton/);

  const bad = fakeLlm({ extract: [extraction()] });
  await assert.rejects(extractMeeting({ llm: bad.llm, model: "m", pdf: PDF, listed: listed("2027-01-11"), roster: ROSTER, openFollowUps: [] }));
});

test("revises once when the review finds an error, and keeps what is still unresolved", async () => {
  const wrong = extraction({ keyVotes: [{ ...extraction().keyVotes[0], mover: "dalton", seconder: "chapman" }] });
  const { llm, calls } = fakeLlm({
    extract: [wrong],
    review: [
      { issues: [{ severity: "error", where: "keyVotes[0].mover", problem: "Chapman made the motion.", evidence: '"Commissioner Chapman moved" (p. 4)' }] },
      { issues: [{ severity: "warning", where: "newFollowUps[0]", problem: "May be routine.", evidence: "" }] },
    ],
    revise: [extraction()],
  });
  const result = await extractMeeting({ llm, model: "m", pdf: PDF, listed: listed("2026-03-09"), roster: ROSTER, openFollowUps: [] });

  assert.deepEqual(calls.map((c) => c.task), ["extract", "review", "revise", "review"]);
  assert.match(calls[2].instructions, /Chapman made the motion/);
  assert.equal(result.revised, true);
  assert.equal(result.meeting.keyVotes[0].mover, "chapman");
  assert.deepEqual(result.warnings, ["Check — newFollowUps[0]: May be routine."]);
  assert.deepEqual(result.meeting.extraction?.warnings, result.warnings);
});

test("revises when the deterministic checks fail even if the review is clean", async () => {
  const inconsistent = extraction({ attendees: ["mccall", "chapman"] }); // dalton seconds and votes but is not present
  const { llm, calls } = fakeLlm({ extract: [inconsistent], revise: [extraction()] });
  const result = await extractMeeting({ llm, model: "m", pdf: PDF, listed: listed("2026-03-09"), roster: ROSTER, openFollowUps: [] });
  assert.deepEqual(calls.map((c) => c.task), ["extract", "review", "revise", "review"]);
  assert.match(calls[1].instructions, /seconder "dalton" is not listed as present/);
  assert.deepEqual(result.warnings, []);
});

test("ignores updates to follow-ups that are not open", async () => {
  const { llm } = fakeLlm({ extract: [extraction({ followUpUpdates: [{ id: "2026-01-12-fu-9", status: "resolved", resolution: "Done." }] })], revise: [extraction()] });
  const result = await extractMeeting({ llm, model: "m", pdf: PDF, listed: listed("2026-03-09"), roster: ROSTER, openFollowUps: [] });
  assert.deepEqual(result.followUpUpdates, []);
});

test("plans only new meetings with posted PDF minutes, oldest first, up to the limit", () => {
  const all = [
    listed("2026-04-13"),
    listed("2026-02-23"),
    listed("2026-02-09"),
    listed("2026-03-09"),
    listed("2026-03-23"),
    { ...listed("2026-05-11"), minutesUrl: undefined },
    listed("2026-01-12"),
    listed("2025-12-08"),
    { ...listed("2026-04-27"), minutesUrl: "https://example.org/minutes.doc" },
    listed("2026-12-14"),
  ];
  const plan = planIngest(all, [storedMeeting("2026-02-09")], options(), "2026-06-01");
  assert.deepEqual(plan.toProcess.map((m) => m.date), ["2026-02-23", "2026-03-09", "2026-03-23"]);
  assert.deepEqual(plan.outOfOrder.map((m) => m.date), ["2026-01-12"]);
  assert.deepEqual(plan.awaitingMinutes.map((m) => m.date), ["2026-05-11"]);
  assert.deepEqual(plan.skipped.map((s) => s.meeting.date), ["2026-04-27"]);

  const rebuild = planIngest(all, [storedMeeting("2026-02-09")], options({ force: true, limit: 1 }), "2026-06-01");
  assert.deepEqual(rebuild.toProcess.map((m) => m.date), ["2026-01-12", "2026-02-09", "2026-02-23", "2026-03-09", "2026-03-23", "2026-04-13"]);

  const one = planIngest(all, [storedMeeting("2026-02-09")], options({ only: ["2026-01-12"] }), "2026-06-01");
  assert.deepEqual(one.toProcess.map((m) => m.date), ["2026-01-12"]);
});

test("carries follow-ups from one meeting to the next and writes every changed file", async () => {
  const meetings: StoredMeeting[] = [];
  const saved: string[] = [];
  const { llm, calls } = fakeLlm({
    extract: [
      extraction(),
      extraction({ newFollowUps: [], followUpUpdates: [{ id: "2026-03-09-fu-1", status: "resolved", resolution: "Staff presented the sidewalk plan." }] }),
    ],
  });
  const plan = planIngest([listed("2026-03-09"), listed("2026-03-23")], meetings, options(), "2026-06-01");
  // Takes a second, defaulted argument like the real saveMeeting(meeting, dir) does.
  const save = (m: StoredMeeting, dir: string = "data") => {
    assert.equal(dir, "data");
    saved.push(m.id);
  };
  const run = await runIngest({ plan, meetings, roster: ROSTER, options: options(), llm, model: "m", downloadPdf: async () => PDF, save });
  const { results } = run;
  assert.equal(run.stopped, undefined);

  assert.equal(results.length, 2);
  const secondExtract = calls.filter((c) => c.task === "extract")[1];
  assert.match(secondExtract.instructions, /\[2026-03-09-fu-1\] raised 2026-03-09, owner staff, currently open: Bring back a sidewalk plan\./);

  const first = meetings.find((m) => m.id === "2026-03-09")!;
  assert.deepEqual(first.followUps[0], {
    id: "2026-03-09-fu-1",
    dateRaised: "2026-03-09",
    owner: "staff",
    description: "Bring back a sidewalk plan.",
    status: "resolved",
    categories: ["infrastructure"],
    relatedMeetingId: "2026-03-09",
    resolution: "Staff presented the sidewalk plan.",
    lastReferencedMeetingId: "2026-03-23",
    resolvedMeetingId: "2026-03-23",
    resolvedDate: "2026-03-23",
  });
  assert.deepEqual(saved, ["2026-03-09", "2026-03-23", "2026-03-09"]);

  const report = buildReport(run, plan, "m");
  assert.match(report, /## 2026-03-09/);
  assert.match(report, /against: mccall \(p\. 4\)/);
  assert.match(report, /`2026-03-09-fu-1` → resolved: Bring back a sidewalk plan\. — Staff presented the sidewalk plan\./);
});

test("a rebuild first undoes what the rebuilt meetings did to earlier follow-ups", async () => {
  const earlier = storedMeeting("2026-02-09", {
    followUps: [{ id: "2026-02-09-fu-1", dateRaised: "2026-02-09", owner: "staff", description: "Hire a planner.", status: "resolved", categories: [], relatedMeetingId: "2026-02-09", resolution: "Hired.", resolvedMeetingId: "2026-03-09", resolvedDate: "2026-03-09", lastReferencedMeetingId: "2026-03-09" }],
  });
  const meetings = [earlier, storedMeeting("2026-03-09")];
  const { llm, calls } = fakeLlm({ extract: [extraction({ newFollowUps: [] })] });
  const opts = options({ force: true, since: "2026-03-01" });
  const plan = planIngest([listed("2026-02-09"), listed("2026-03-09")], meetings, opts, "2026-06-01");
  assert.deepEqual(plan.toProcess.map((m) => m.date), ["2026-03-09"]);

  await runIngest({ plan, meetings, roster: ROSTER, options: opts, llm, model: "m", downloadPdf: async () => PDF, save: () => {} });
  assert.match(calls[0].instructions, /\[2026-02-09-fu-1\].*currently open: Hire a planner\./);
  assert.equal(earlier.followUps[0].status, "open");
  assert.equal(earlier.followUps[0].resolvedMeetingId, undefined);
  assert.equal(meetings.length, 2);
});

test("a failure keeps the meetings already done and stops before later ones", async () => {
  const meetings: StoredMeeting[] = [];
  const saved: string[] = [];
  const { llm } = fakeLlm({ extract: [extraction()] }); // nothing queued for the second meeting, so it throws
  const plan = planIngest([listed("2026-03-09"), listed("2026-03-23"), listed("2026-04-13")], meetings, options(), "2026-06-01");
  const run = await runIngest({ plan, meetings, roster: ROSTER, options: options(), llm, model: "m", downloadPdf: async () => PDF, save: (m) => saved.push(m.id) });

  assert.deepEqual(run.results.map((r) => r.meeting.id), ["2026-03-09"]);
  assert.equal(run.stopped?.date, "2026-03-23");
  assert.deepEqual(saved, ["2026-03-09"]);
  assert.deepEqual(meetings.map((m) => m.id), ["2026-03-09"]);

  const report = buildReport(run, plan, "m");
  assert.match(report, /This run stopped early.*2026-03-23 failed.*not processed: 2026-03-23, 2026-04-13.*"since" set to 2026-03-23/);
});

test("a report too long for a pull request description is shortened, keeping what needs checking", async () => {
  const meetings: StoredMeeting[] = [];
  const dates = Array.from({ length: 12 }, (_, i) => `2026-03-${String(i + 10).padStart(2, "0")}`);
  const long = "The board discussed the matter at length. ".repeat(40);
  const { llm } = fakeLlm({
    extract: dates.map(() => extraction({ tldr: long })),
    review: dates.map(() => ({ issues: [{ severity: "warning" as const, where: "tldr", problem: "Worth a look. ".repeat(60), evidence: "" }] })),
  });
  const plan = planIngest(dates.map((d) => listed(d)), meetings, options({ limit: 50 }), "2026-06-01");
  const run = await runIngest({ plan, meetings, roster: ROSTER, options: options({ limit: 50 }), llm, model: "m", downloadPdf: async () => PDF, save: () => {} });

  const full = buildReport(run, plan, "m");
  assert.match(full, /The board discussed the matter at length/);

  const short = buildReport(run, plan, "m", 12_000);
  assert.ok(short.length <= 12_000);
  assert.match(short, /Shortened to fit/);
  assert.doesNotMatch(short, /The board discussed the matter at length/);
  for (const d of dates) assert.match(short, new RegExp(`## ${d}`));
  assert.match(short, /against: mccall/);
  assert.match(short, /Check — tldr: Worth a look\./);

  assert.ok(buildReport(run, plan, "m", 2_000).length <= 2_000);
});
