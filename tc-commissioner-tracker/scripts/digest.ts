/**
 * Experimental: write a digest (email HTML, plain text) for each meeting and
 * an RSS feed to out/digest/ so they can be looked at. Nothing is sent or
 * published.
 *
 *   npm run digest
 *   npm run digest -- --site https://example.org
 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { buildDigest, buildFeed } from "./lib/digest";
import { ROOT, loadMeetings, loadRoster } from "./lib/store";

const { values } = parseArgs({ options: { site: { type: "string" } } });
const siteUrl = (values.site ?? process.env.SITE_URL ?? "https://example.org").replace(/\/$/, "");

const allMeetings = loadMeetings();
const context = { roster: loadRoster(), allMeetings, siteUrl };
const outDir = path.join(ROOT, "out/digest");
fs.mkdirSync(outDir, { recursive: true });

for (const meeting of allMeetings) {
  const digest = buildDigest(meeting, context);
  fs.writeFileSync(path.join(outDir, `${meeting.id}.html`), digest.html);
  fs.writeFileSync(path.join(outDir, `${meeting.id}.txt`), digest.text);
}
fs.writeFileSync(path.join(outDir, "feed.xml"), buildFeed(allMeetings, context));
console.log(`Wrote ${allMeetings.length} digest(s) and feed.xml to out/digest/ (links point at ${siteUrl}).`);
