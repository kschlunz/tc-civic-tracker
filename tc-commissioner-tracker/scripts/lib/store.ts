/** Reading and writing the data files in src/data. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { CommissionerSchema, PublicStatementSchema, StoredMeetingSchema } from "../../src/lib/schema";
import type { CommissionerRecord, StoredMeeting, StoredStatement } from "../../src/lib/types";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "../..");
export const DATA_DIR = path.join(ROOT, "src/data");
export const MEETINGS_DIR = path.join(DATA_DIR, "meetings");
export const GENERATED_DIR = path.join(DATA_DIR, "generated");
export const STATEMENTS_FILE = path.join(DATA_DIR, "statements.json");

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

/** Parse with a schema, naming the file in any error. */
function parseFile<T>(schema: z.ZodType<T>, file: string): T {
  const result = schema.safeParse(readJson(file));
  if (!result.success) {
    throw new Error(`${path.relative(ROOT, file)} is invalid:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export function meetingFile(id: string, dir: string = MEETINGS_DIR): string {
  return path.join(dir, `${id}.json`);
}

/** All stored meetings, oldest first. Throws if any file fails validation. */
export function loadMeetings(dir: string = MEETINGS_DIR): StoredMeeting[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const meeting = parseFile(StoredMeetingSchema, path.join(dir, f));
      if (`${meeting.id}.json` !== f) throw new Error(`${f}: file name must match the meeting id "${meeting.id}"`);
      return meeting;
    });
}

export function saveMeeting(meeting: StoredMeeting, dir: string = MEETINGS_DIR): void {
  writeJson(meetingFile(meeting.id, dir), StoredMeetingSchema.parse(meeting));
}

export function loadRoster(): CommissionerRecord[] {
  return parseFile(z.array(CommissionerSchema), path.join(DATA_DIR, "commissioners.json"));
}

export function loadStatements(file: string = STATEMENTS_FILE): StoredStatement[] {
  return parseFile(z.array(PublicStatementSchema), file);
}

export function saveStatements(statements: StoredStatement[], file: string = STATEMENTS_FILE): void {
  const sorted = [...statements].sort(
    (a, b) => b.date.localeCompare(a.date) || a.commissionerId.localeCompare(b.commissionerId),
  );
  writeJson(file, z.array(PublicStatementSchema).parse(sorted));
}

export { writeJson };
