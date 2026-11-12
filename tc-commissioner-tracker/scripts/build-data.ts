/**
 * Validates every file in src/data and writes the bundle the app imports.
 * Runs automatically before dev, build, lint, typecheck and test.
 *
 *   npm run data
 */
import path from "node:path";
import { ElectionSchema } from "../src/lib/schema";
import { checkStoredMeetings } from "./lib/validate";
import { DATA_DIR, GENERATED_DIR, loadMeetings, loadRoster, loadStatements, writeJson } from "./lib/store";
import fs from "node:fs";

const roster = loadRoster();
const meetings = loadMeetings();
const statements = loadStatements();
ElectionSchema.parse(JSON.parse(fs.readFileSync(path.join(DATA_DIR, "election.json"), "utf8")));

const problems = checkStoredMeetings(meetings, roster);
const rosterIds = new Set(roster.map((r) => r.id));
for (const s of statements) {
  if (!rosterIds.has(s.commissionerId)) problems.push(`statements.json: unknown commissioner "${s.commissionerId}"`);
}

if (problems.length > 0) {
  console.error(`Data check failed:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}

writeJson(path.join(GENERATED_DIR, "meetings.json"), meetings);
console.log(`Data OK: ${meetings.length} meeting(s), ${statements.length} statement(s), ${roster.length} commissioner(s).`);
