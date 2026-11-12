import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDigest, buildFeed } from "../scripts/lib/digest";
import { ROSTER, storedMeeting } from "./helpers";

const vote = (overrides = {}) => ({
  description: "Approve paving contract",
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

const earlier = storedMeeting("2026-02-09", {
  followUps: [{ id: "2026-02-09-fu-1", dateRaised: "2026-02-09", owner: "staff", description: "Hire a planner", status: "resolved", categories: [], relatedMeetingId: "2026-02-09", resolution: "Planner hired.", resolvedMeetingId: "2026-03-09", resolvedDate: "2026-03-09", lastReferencedMeetingId: "2026-03-09" }],
});
const meeting = storedMeeting("2026-03-09", {
  tldr: "Board split on paving & approved a grant <application>.",
  keyVotes: [vote(), vote({ description: "Accept library grant", result: "Unanimous", votes: { ayes: ["mccall", "chapman", "dalton"], nays: [], abstained: [], absent: [] } }), vote({ description: "Consent agenda", consent: true, result: "Unanimous", votes: null })],
  followUps: [{ id: "2026-03-09-fu-1", dateRaised: "2026-03-09", owner: "mccall", description: "Schedule a roads workshop", status: "open", categories: [], relatedMeetingId: "2026-03-09" }],
  publicComments: [{ speaker: "Pat Doe", summary: "Asked for sidewalks." }],
});
const context = { roster: ROSTER, allMeetings: [earlier, meeting], siteUrl: "https://ledger.example" };

test("digest leads with contested votes and names who voted against", () => {
  const digest = buildDigest(meeting, context);
  assert.equal(digest.subject, "County commissioners, March 9, 2026");
  assert.match(digest.text, /CONTESTED VOTES\n- Approve paving contract — passed 2-1\. Against: Teresa McCall\./);
  assert.match(digest.text, /ALSO APPROVED\n- Accept library grant\n/);
  assert.doesNotMatch(digest.text, /Consent agenda/);
  assert.match(digest.text, /NEW COMMITMENTS TO WATCH\n- Schedule a roads workshop \(Teresa McCall\)/);
  assert.match(digest.text, /EARLIER COMMITMENTS UPDATED\n- Hire a planner — resolved: Planner hired\./);
  assert.match(digest.text, /Full record: https:\/\/ledger\.example\/meetings\/2026-03-09/);
});

test("digest HTML escapes the record's text", () => {
  const { html } = buildDigest(meeting, context);
  assert.match(html, /paving &amp; approved a grant &lt;application&gt;\./);
  assert.doesNotMatch(html, /<application>/);
});

test("feed lists meetings newest first", () => {
  const feed = buildFeed([earlier, meeting], context);
  assert.ok(feed.indexOf("March 9, 2026") < feed.indexOf("February 9, 2026"));
  assert.match(feed, /<guid isPermaLink="true">https:\/\/ledger\.example\/meetings\/2026-03-09<\/guid>/);
  assert.equal((feed.match(/<item>/g) ?? []).length, 2);
});
