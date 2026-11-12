import assert from "node:assert/strict";
import { test } from "node:test";
import { toMeeting } from "../src/lib/derive";
import { buildRoster, roleOn, seatedOn, todayISO } from "../src/lib/roster";
import { checkMeeting, checkStoredMeetings } from "../scripts/lib/validate";
import { loadMeetings, loadRoster } from "../scripts/lib/store";
import { ROSTER, storedMeeting } from "./helpers";

const vote = (overrides = {}) => ({
  description: "Approve contract",
  result: "2-1",
  passed: true,
  consent: false,
  mover: "chapman",
  seconder: "dalton",
  votes: { ayes: ["chapman", "dalton"], nays: ["mccall"], abstained: [], absent: [] },
  background: "",
  discussion: "",
  page: 3,
  ...overrides,
});

test("roster works out who is seated and their role on a date", () => {
  const dalton = ROSTER.find((r) => r.id === "dalton")!;
  assert.equal(seatedOn(dalton, "2026-12-06"), true);
  assert.equal(seatedOn(dalton, "2026-12-07"), false);
  assert.equal(seatedOn(dalton, "2020-12-06"), false);

  const mccall = ROSTER.find((r) => r.id === "mccall")!;
  assert.equal(roleOn(mccall, "2025-12-07"), "Commissioner");
  assert.equal(roleOn(mccall, "2025-12-08"), "Chair");

  const after = buildRoster(ROSTER, "2027-01-01");
  assert.deepEqual(after.map((c) => [c.id, c.current, c.role]), [
    ["mccall", true, "Chair"],
    ["chapman", true, "Commissioner"],
    ["dalton", false, "Former Commissioner"],
  ]);
  assert.equal(after[2].note, undefined);
  assert.equal(buildRoster(ROSTER, "2026-06-01")[2].note, "Not running '26");
});

test("todayISO uses the county's time zone", () => {
  assert.equal(todayISO(new Date("2026-11-13T03:30:00Z")), "2026-11-12");
});

test("motion counts are derived from the votes", () => {
  const meeting = toMeeting(storedMeeting("2026-03-09", { keyVotes: [vote(), vote({ mover: "chapman", seconder: "mccall" }), vote({ consent: true, mover: null, seconder: null })] }));
  assert.deepEqual(
    Object.fromEntries(Object.entries(meeting.commissionerActivity).map(([id, a]) => [id, [a.motionsMade, a.motionsSeconded]])),
    { mccall: [0, 1], chapman: [2, 0], dalton: [0, 1] },
  );
});

test("a consistent meeting has no problems", () => {
  assert.deepEqual(checkMeeting(storedMeeting("2026-03-09", { keyVotes: [vote()] }), ROSTER), []);
});

test("flags roll calls that contradict the result", () => {
  const problems = checkMeeting(storedMeeting("2026-03-09", { keyVotes: [vote({ result: "Unanimous" })] }), ROSTER);
  assert.match(problems.join("\n"), /result "Unanimous" does not match the roll call \(2-1\)/);
});

test("flags people who were not on the board or not present", () => {
  const problems = checkMeeting(
    storedMeeting("2027-01-11", { attendees: ["mccall", "chapman"], keyVotes: [vote({ result: "Unanimous", votes: { ayes: ["chapman", "dalton"], nays: [], abstained: [], absent: [] } })] }),
    ROSTER,
  ).join("\n");
  assert.match(problems, /Jake Dalton was not on the board on 2027-01-11/);
  assert.match(problems, /seconder "dalton" is not listed as present/);
});

test("flags a mover voting against their own motion and identical mover and seconder", () => {
  const problems = checkMeeting(
    storedMeeting("2026-03-09", { keyVotes: [vote({ mover: "mccall", seconder: "mccall" })] }),
    ROSTER,
  ).join("\n");
  assert.match(problems, /mover and seconder are the same person/);
  assert.match(problems, /mover is recorded voting against/);
});

test("flags malformed follow-ups and dangling references", () => {
  const followUp = { id: "2026-03-09-fu-1", dateRaised: "2026-03-09", owner: "staff", description: "x", status: "resolved" as const, categories: [], relatedMeetingId: "2026-03-09" };
  assert.match(checkMeeting(storedMeeting("2026-03-09", { followUps: [followUp] }), ROSTER).join("\n"), /resolved but no resolvedMeetingId/);

  const dangling = storedMeeting("2026-03-09", { followUps: [{ ...followUp, resolvedMeetingId: "2026-04-13", resolvedDate: "2026-04-13" }] });
  assert.match(checkStoredMeetings([dangling], ROSTER).join("\n"), /refers to meeting 2026-04-13, which is not stored/);
});

test("the committed data files are valid", () => {
  assert.deepEqual(checkStoredMeetings(loadMeetings(), loadRoster()), []);
});
