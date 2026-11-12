import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { inferMeetingType, parseMeetingsPage } from "../scripts/lib/county";

const fixture = (name: string) => fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", name), "utf8");

test("parses the current meetings page", () => {
  const rows = parseMeetingsPage(fixture("meetings-page-0.html"));
  assert.equal(rows.length, 25);

  const feb = rows.find((r) => r.date === "2026-02-09");
  assert.deepEqual(feb, {
    date: "2026-02-09",
    title: "Commissioners' Meeting 02/09/26",
    type: "regular",
    time: "4:00 PM",
    pageUrl: "https://www.transylvaniacounty.org/meetings/commissioners-meeting-020926",
    agendaUrl: "https://www.transylvaniacounty.org/sites/default/files/departments/administration/agendas/2026-02-09%20BOC%20Agenda.pdf",
    minutesUrl: "https://www.transylvaniacounty.org/sites/default/files/departments/administration/minutes/2026-02-09%20reg%20mtg.pdf",
    videoUrl: "https://vimeo.com/event/5710563",
  });
});

test("takes the date from the page, not from file names", () => {
  const rows = parseMeetingsPage(fixture("meetings-page-0.html"));
  // The county's agenda file for this meeting is misnamed "2024-08-24".
  const aug = rows.find((r) => r.agendaUrl?.includes("2024-08-24"));
  assert.equal(aug?.date, "2026-08-24");
  // Untitled-by-date workshop: the date only appears in the heading and day badge.
  const workshop = rows.find((r) => r.title === "Board of Commissioners - Budget Workshop");
  assert.equal(workshop?.date, "2026-06-02");
  assert.equal(workshop?.type, "workshop");
});

test("keeps the real minutes link when the file name is irregular", () => {
  const rows = parseMeetingsPage(fixture("meetings-page-0.html"));
  assert.match(rows.find((r) => r.date === "2025-06-23")!.minutesUrl!, /2025-06-23%20reg%20mtg%20%26%20PH%20%282%29\.pdf$/);
  const pending = rows.find((r) => r.date === "2026-10-26")!;
  assert.equal(pending.minutesUrl, undefined);
  assert.ok(pending.agendaUrl);
});

test("parses older pages with special and joint meetings", () => {
  const rows = parseMeetingsPage(fixture("meetings-page-12.html"));
  assert.equal(rows.length, 25);
  assert.equal(rows.find((r) => r.date === "2014-06-25")?.type, "special");
  assert.equal(rows.find((r) => r.date === "2014-02-25")?.type, "special");
  assert.equal(rows.find((r) => r.date === "2014-06-23")?.type, "regular");
  assert.ok(rows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date)));
});

test("returns nothing for a page without meetings", () => {
  assert.deepEqual(parseMeetingsPage("<html><body>Maintenance</body></html>"), []);
});

test("infers meeting types from titles", () => {
  assert.equal(inferMeetingType("OATH OF OFFICE CEREMONY, ORGANIZATIONAL MEETING OF THE BOARD"), "organizational");
  assert.equal(inferMeetingType("FY 2026 Budget Workshop 2 06/17/25"), "workshop");
  assert.equal(inferMeetingType("Commissioners' Meeting 01/12/26"), "regular");
});
