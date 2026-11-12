/**
 * Single source of truth for the shape of the data in src/data.
 *
 * The ingestion pipeline (scripts/) validates everything it writes against
 * these schemas, `npm run data` re-validates every file before a build, and the
 * app's TypeScript types are inferred from them (see types.ts).
 */
import { z } from "zod";

export const CATEGORY_IDS = [
  "fiscal",
  "schools",
  "safety",
  "infrastructure",
  "econ",
  "governance",
  "environment",
  "housing",
  "health",
  "recovery",
  "community",
] as const;

export const MEETING_TYPES = ["regular", "special", "workshop", "organizational"] as const;
export const FOLLOW_UP_STATUSES = ["open", "in_progress", "resolved", "dropped"] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const categoryId = z.enum(CATEGORY_IDS);

export const MeetingTopicSchema = z.object({
  text: z.string().min(1),
  categories: z.array(categoryId),
});

export const VoteBreakdownSchema = z.object({
  ayes: z.array(z.string()),
  nays: z.array(z.string()),
  abstained: z.array(z.string()),
  absent: z.array(z.string()),
});

export const KeyVoteSchema = z.object({
  description: z.string().min(1),
  /** "Unanimous" or a split such as "4-1" (ayes-nays). */
  result: z.string().min(1),
  passed: z.boolean(),
  /** True when the item was approved as part of the consent agenda. */
  consent: z.boolean(),
  /** Commissioner id, or null when the minutes do not name one. */
  mover: z.string().nullable(),
  seconder: z.string().nullable(),
  /** How each commissioner voted. Null when the minutes do not say. */
  votes: VoteBreakdownSchema.nullable(),
  background: z.string(),
  discussion: z.string(),
  /** 1-indexed page of the minutes PDF where the vote is recorded. */
  page: z.number().int().positive().nullable(),
});

export const PublicCommentSchema = z.object({
  speaker: z.string().min(1),
  summary: z.string().min(1),
});

export const FollowUpSchema = z.object({
  id: z.string().regex(/^\d{4}-\d{2}-\d{2}-fu-\d+$/, "expected <meeting date>-fu-<n>"),
  dateRaised: isoDate,
  /** Commissioner id, a staff member's full name, or "staff". */
  owner: z.string().min(1),
  description: z.string().min(1),
  status: z.enum(FOLLOW_UP_STATUSES),
  categories: z.array(categoryId),
  relatedMeetingId: isoDate,
  lastReferencedMeetingId: isoDate.optional(),
  resolvedDate: isoDate.optional(),
  resolvedMeetingId: isoDate.optional(),
  resolution: z.string().optional(),
});

/** What is stored per commissioner in a meeting file. Motion counts are derived at load time. */
export const StoredActivitySchema = z.object({
  topics: z.array(MeetingTopicSchema),
  externalRoles: z.array(z.string()),
});

export const ExtractionInfoSchema = z.object({
  model: z.string(),
  extractedAt: z.string(),
  /** Unresolved concerns from the automated checks, shown to the reviewer. */
  warnings: z.array(z.string()),
});

export const StoredMeetingSchema = z.object({
  id: isoDate,
  date: isoDate,
  type: z.enum(MEETING_TYPES),
  /** The county's own title for the meeting, e.g. "Commissioners' Meeting 02/09/26". */
  title: z.string().optional(),
  time: z.string(),
  duration: z.string().nullable(),
  audienceSize: z.number().int().nonnegative().nullable(),
  attendees: z.array(z.string()),
  tldr: z.string().min(1),
  keyVotes: z.array(KeyVoteSchema),
  commissionerActivity: z.record(z.string(), StoredActivitySchema),
  publicComments: z.array(PublicCommentSchema),
  followUps: z.array(FollowUpSchema),
  /** Official links, taken from the county's meetings page (never guessed). */
  sourceUrl: z.string().url(),
  agendaUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  extraction: ExtractionInfoSchema.optional(),
});

export const CommissionerSchema = z.object({
  id: z.string().regex(/^[a-z]+$/),
  name: z.string(),
  color: z.string(),
  /** Year first elected to the board, for display. */
  since: z.string(),
  /** Periods on the board. `end` is omitted while the term is running. */
  terms: z.array(z.object({ start: isoDate, end: isoDate.optional() })).min(1),
  /** Leadership roles held, e.g. Chair. Plain members need no entry. */
  roles: z.array(z.object({ role: z.string(), start: isoDate, end: isoDate.optional() })),
  /** Short note shown on the commissioner's card, e.g. "Not running '26". */
  note: z.string().optional(),
});

export const ElectionSchema = z.object({
  date: isoDate,
  label: z.string(),
  openSeats: z.number().int().nonnegative(),
  note: z.string(),
  candidates: z.array(z.object({ name: z.string(), party: z.string() })),
  /** Names of the certified winners. Empty until results are official. */
  winners: z.array(z.string()),
  resultsUrl: z.string().url().optional(),
});

export const PublicStatementSchema = z.object({
  commissionerId: z.string(),
  date: isoDate,
  source: z.string(),
  type: z.enum(["news", "statement"]),
  text: z.string().min(1),
  url: z.string().url().optional(),
  categories: z.array(categoryId),
});
