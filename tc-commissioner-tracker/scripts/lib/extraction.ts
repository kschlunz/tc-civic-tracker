/**
 * Turning a minutes PDF into a meeting record: extract, check, revise.
 *
 * The model is reached through the small `Llm` interface so the whole flow can
 * be tested without network access (see tests/extraction.test.ts).
 */
import { z } from "zod";
import { CATEGORY_IDS } from "../../src/lib/schema";
import { voteResultLabel } from "../../src/lib/derive";
import { seatedOn } from "../../src/lib/roster";
import type { CommissionerRecord, FollowUpItem, StoredMeeting } from "../../src/lib/types";
import type { ListedMeeting } from "./county";
import { checkMeeting } from "./validate";

export const CATEGORY_LABELS: Record<(typeof CATEGORY_IDS)[number], string> = {
  fiscal: "Fiscal Policy & Revenue",
  schools: "Schools & Capital",
  safety: "Public Safety",
  infrastructure: "Infrastructure",
  econ: "Economic Development",
  governance: "Transparency & Governance",
  environment: "Environment & Land",
  housing: "Housing",
  health: "Health & Human Services",
  recovery: "Helene Recovery",
  community: "Community & Culture",
};

/** One structured request to the model about one PDF. */
export interface LlmRequest<T> {
  /** Short name for logs, e.g. "extract". */
  task: string;
  system: string;
  pdf: Buffer;
  instructions: string;
  schema: z.ZodType<T>;
}
export type Llm = <T>(request: LlmRequest<T>) => Promise<T>;

export type OpenFollowUp = Pick<FollowUpItem, "id" | "dateRaised" | "owner" | "description" | "status">;

/** What the model returns. Ids, dates and links are added by the pipeline, never by the model. */
export function extractionSchema(commissionerIds: [string, ...string[]]) {
  const commissioner = z.enum(commissionerIds);
  const category = z.enum(CATEGORY_IDS);
  return z.object({
    duration: z.string().nullable().describe('Length of the meeting, e.g. "2 hours 40 minutes", worked out from the stated start and adjournment times. Null if the minutes do not give both.'),
    audienceSize: z.number().int().nullable().describe("Number of members of the public present, only if the minutes state it. Otherwise null."),
    attendees: z.array(commissioner).describe("Commissioners recorded as present."),
    tldr: z.string().describe("Two to four plain sentences a resident could read to know what happened: the decisions made and the main subjects discussed."),
    keyVotes: z.array(
      z.object({
        description: z.string().describe("What was decided, as a short headline with the key figure if there is one."),
        consent: z.boolean().describe("True if this was approved as part of the consent agenda."),
        mover: commissioner.nullable(),
        seconder: commissioner.nullable(),
        ayes: z.array(commissioner),
        nays: z.array(commissioner),
        abstained: z.array(commissioner),
        absent: z.array(commissioner).describe("Commissioners absent or recused for this vote."),
        rollCallKnown: z.boolean().describe("False only when the minutes give the outcome without saying how members voted and it cannot be inferred."),
        passed: z.boolean(),
        background: z.string().describe("Two or three sentences: why the item was on the agenda, who presented it, the key facts and figures."),
        discussion: z.string().describe("What commissioners said or asked before voting. Empty string if there was no discussion."),
        page: z.number().int().nullable().describe("1-indexed page of the PDF where the vote is recorded."),
      }),
    ),
    commissionerActivity: z.array(
      z.object({
        commissioner,
        topics: z.array(z.object({ text: z.string(), categories: z.array(category) })),
        externalRoles: z.array(z.string()).describe("Outside boards or committees the minutes say this commissioner serves on or reported from."),
      }),
    ),
    publicComments: z.array(z.object({ speaker: z.string(), summary: z.string() })),
    newFollowUps: z.array(
      z.object({
        owner: z.string().describe('A commissioner id, the full name of a staff member, or "staff" if no individual is named.'),
        description: z.string(),
        categories: z.array(category),
      }),
    ),
    followUpUpdates: z.array(
      z.object({
        id: z.string().describe("Id of an open follow-up from the list provided."),
        status: z.enum(["in_progress", "resolved", "dropped"]),
        resolution: z.string().describe("One or two sentences on what happened at this meeting."),
      }),
    ),
  });
}
export type Extraction = z.infer<ReturnType<typeof extractionSchema>>;

export const ReviewSchema = z.object({
  issues: z.array(
    z.object({
      severity: z.enum(["error", "warning"]).describe('"error": the record states something the minutes contradict or do not support, or omits a vote. "warning": a judgement call a human should look at.'),
      where: z.string().describe('The part of the record concerned, e.g. "keyVotes[2].mover".'),
      problem: z.string(),
      evidence: z.string().describe("Short quote from the minutes, with page number, that shows the problem."),
    }),
  ),
});
export type Review = z.infer<typeof ReviewSchema>;

export function buildSystemPrompt(roster: CommissionerRecord[], meetingDate: string): string {
  const seated = roster.filter((r) => seatedOn(r, meetingDate));
  return `You help maintain a public, non-partisan record of the Transylvania County (North Carolina) Board of Commissioners. Residents use it to see how their commissioners vote and whether commitments made in meetings are kept, so accuracy matters more than completeness: every statement in the record must be supported by the official minutes you are given. When the minutes are silent or ambiguous, leave the field empty or null rather than inferring.

Commissioners on the board on ${meetingDate} (use these ids):
${seated.map((r) => `- ${r.id}: ${r.name}`).join("\n")}

Topic categories (use these ids):
${Object.entries(CATEGORY_LABELS).map(([id, label]) => `- ${id}: ${label}`).join("\n")}

Conventions for the record:
- Votes: include every motion the board voted on, including approval of the agenda, the consent agenda (as one vote, with "consent" true) and procedural motions such as entering closed session or adjourning. When the minutes say a motion passed unanimously, list every commissioner present for that vote under ayes. When they give a split, name who voted each way.
- Commissioner activity: for each commissioner present, the substantive points they raised, questions they asked and positions they took, one concise sentence each, written in the past tense and attributed only when the minutes attribute them. Do not list motions here; those are captured as votes.
- Public comments: everyone who spoke during public comment or a public hearing, with their full name as written and a neutral summary of what they said.
- Follow-ups are commitments to do something later that a resident could check on: staff will bring an item back, a workshop will be scheduled, a report will be provided, a position will be filled. Routine next steps that are certain to happen anyway (the next regular meeting, signing an approved contract) are not follow-ups.
- Write neutrally. Describe what was said and decided without characterising motives or quality.`;
}

function formatOpenFollowUps(open: OpenFollowUp[]): string {
  if (open.length === 0) return "There are no open follow-up items from earlier meetings.";
  return `Open follow-up items from earlier meetings:
${open.map((f) => `- [${f.id}] raised ${f.dateRaised}, owner ${f.owner}, currently ${f.status}: ${f.description}`).join("\n")}

If these minutes show one of them being acted on, add it to followUpUpdates: "resolved" when the commitment was fully met, "in_progress" when there was a concrete step or update, "dropped" when the board or staff said it will not happen. Include an item only when the minutes clearly refer to it; most meetings touch few or none.`;
}

function meetingLine(listed: ListedMeeting): string {
  return `These are the official minutes of the ${listed.type} meeting held on ${listed.date} ("${listed.title}").`;
}

/** Assemble the stored record from the model's output and the county's listing. */
export function toStoredMeeting(extraction: Extraction, listed: ListedMeeting & { minutesUrl: string }, model: string): StoredMeeting {
  return {
    id: listed.date,
    date: listed.date,
    type: listed.type,
    title: listed.title,
    time: listed.time,
    duration: extraction.duration,
    audienceSize: extraction.audienceSize,
    attendees: extraction.attendees,
    tldr: extraction.tldr,
    keyVotes: extraction.keyVotes.map((v) => ({
      description: v.description,
      result: v.rollCallKnown ? voteResultLabel(v.ayes.length, v.nays.length) : v.passed ? "Passed" : "Failed",
      passed: v.passed,
      consent: v.consent,
      mover: v.mover,
      seconder: v.seconder,
      votes: v.rollCallKnown ? { ayes: v.ayes, nays: v.nays, abstained: v.abstained, absent: v.absent } : null,
      background: v.background,
      discussion: v.discussion,
      page: v.page,
    })),
    commissionerActivity: Object.fromEntries(
      extraction.commissionerActivity.map((a) => [a.commissioner, { topics: a.topics, externalRoles: a.externalRoles }]),
    ),
    publicComments: extraction.publicComments,
    followUps: extraction.newFollowUps.map((f, i) => ({
      id: `${listed.date}-fu-${i + 1}`,
      dateRaised: listed.date,
      owner: f.owner,
      description: f.description,
      status: "open" as const,
      categories: f.categories,
      relatedMeetingId: listed.date,
    })),
    sourceUrl: listed.minutesUrl,
    ...(listed.agendaUrl ? { agendaUrl: listed.agendaUrl } : {}),
    ...(listed.videoUrl ? { videoUrl: listed.videoUrl } : {}),
    extraction: { model, extractedAt: new Date().toISOString(), warnings: [] },
  };
}

export interface ExtractionResult {
  meeting: StoredMeeting;
  followUpUpdates: Extraction["followUpUpdates"];
  /** Whether a second, corrected draft was needed. */
  revised: boolean;
  /** Everything a reviewer should look at, also stored on the meeting. */
  warnings: string[];
}

function describeIssue(issue: Review["issues"][number]): string {
  return `${issue.where}: ${issue.problem}${issue.evidence ? ` (minutes: ${issue.evidence})` : ""}`;
}

/**
 * Extract a meeting from its minutes, have a second pass check the draft
 * against the PDF, and redo it once if that finds errors.
 */
export async function extractMeeting(input: {
  llm: Llm;
  model: string;
  pdf: Buffer;
  listed: ListedMeeting & { minutesUrl: string };
  roster: CommissionerRecord[];
  openFollowUps: OpenFollowUp[];
}): Promise<ExtractionResult> {
  const { llm, model, pdf, listed, roster, openFollowUps } = input;
  const seatedIds = roster.filter((r) => seatedOn(r, listed.date)).map((r) => r.id);
  if (seatedIds.length === 0) throw new Error(`No commissioners in the roster were seated on ${listed.date}. Update src/data/commissioners.json.`);
  const schema = extractionSchema(seatedIds as [string, ...string[]]);
  const system = buildSystemPrompt(roster, listed.date);
  const openIds = new Set(openFollowUps.map((f) => f.id));

  const finish = (extraction: Extraction) => {
    const dropped: string[] = [];
    const followUpUpdates = extraction.followUpUpdates.filter((u) => {
      if (openIds.has(u.id)) return true;
      dropped.push(`Ignored an update to follow-up "${u.id}", which is not an open item.`);
      return false;
    });
    const meeting = toStoredMeeting(extraction, listed, model);
    return { meeting, followUpUpdates, problems: [...checkMeeting(meeting, roster), ...dropped] };
  };

  const review = (extraction: Extraction, problems: string[]) =>
    llm({
      task: "review",
      system,
      pdf,
      schema: ReviewSchema,
      instructions: `${meetingLine(listed)} Below is a draft record of this meeting prepared from them. Check the draft against the minutes and report every place where it is wrong or unsupported: a vote that is missing or invented, a wrong mover, seconder or roll call, a statement attributed to the wrong person, a figure that differs from the minutes, a public speaker missed or misnamed, a follow-up that is not really a commitment, or an earlier follow-up marked as acted on without clear support. Read the minutes page by page rather than sampling. Report only real discrepancies; an empty list is the right answer for an accurate draft.

${formatOpenFollowUps(openFollowUps)}
${problems.length > 0 ? `\nAutomated consistency checks already flagged:\n${problems.map((p) => `- ${p}`).join("\n")}\n` : ""}
Draft record:
${JSON.stringify(extraction, null, 2)}`,
    });

  let extraction = await llm({
    task: "extract",
    system,
    pdf,
    schema,
    instructions: `${meetingLine(listed)} Read them in full and produce the record of this meeting.

${formatOpenFollowUps(openFollowUps)}`,
  });
  let current = finish(extraction);
  let issues = (await review(extraction, current.problems)).issues;
  let revised = false;

  if (current.problems.length > 0 || issues.some((i) => i.severity === "error")) {
    revised = true;
    extraction = await llm({
      task: "revise",
      system,
      pdf,
      schema,
      instructions: `${meetingLine(listed)} Below is a draft record of this meeting and a list of problems a reviewer found in it. Produce the corrected, complete record. Check each reported problem against the minutes yourself: fix the ones that are right, and leave the draft as it is where the reviewer was mistaken.

${formatOpenFollowUps(openFollowUps)}

Problems found:
${[...current.problems, ...issues.map(describeIssue)].map((p) => `- ${p}`).join("\n")}

Draft record:
${JSON.stringify(extraction, null, 2)}`,
    });
    current = finish(extraction);
    issues = (await review(extraction, current.problems)).issues;
  }

  const warnings = [...current.problems, ...issues.map((i) => `${i.severity === "error" ? "Possible error" : "Check"} — ${describeIssue(i)}`)];
  current.meeting.extraction!.warnings = warnings;
  return { meeting: current.meeting, followUpUpdates: current.followUpUpdates, revised, warnings };
}
