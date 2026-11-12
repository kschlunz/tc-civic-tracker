import type { z } from "zod";
import type {
  CommissionerSchema,
  ElectionSchema,
  FollowUpSchema,
  KeyVoteSchema,
  MeetingTopicSchema,
  PublicCommentSchema,
  PublicStatementSchema,
  StoredMeetingSchema,
  VoteBreakdownSchema,
} from "./schema";

export type MeetingTopic = z.infer<typeof MeetingTopicSchema>;
export type VoteBreakdown = z.infer<typeof VoteBreakdownSchema>;
export type KeyVote = z.infer<typeof KeyVoteSchema>;
export type PublicComment = z.infer<typeof PublicCommentSchema>;
export type FollowUpItem = z.infer<typeof FollowUpSchema>;
export type StoredMeeting = z.infer<typeof StoredMeetingSchema>;
export type CommissionerRecord = z.infer<typeof CommissionerSchema>;
export type Election = z.infer<typeof ElectionSchema>;
export type StoredStatement = z.infer<typeof PublicStatementSchema>;

export interface CommissionerActivity {
  topics: MeetingTopic[];
  externalRoles: string[];
  /** Derived from the meeting's votes when the data is loaded. */
  motionsMade: number;
  motionsSeconded: number;
}

/** A meeting as the app sees it: the stored record plus derived motion counts. */
export interface Meeting extends Omit<StoredMeeting, "commissionerActivity"> {
  commissionerActivity: Record<string, CommissionerActivity>;
}

/** A commissioner as the app sees it, with role and status worked out for today. */
export interface Commissioner {
  id: string;
  name: string;
  /** Current leadership role, "Commissioner", or "Former Commissioner". */
  role: string;
  since: string;
  color: string;
  /** True while a term is running. */
  current: boolean;
  note?: string;
}

export interface Category {
  id: string;
  label: string;
  icon: string;
  color: string;
}

export type PublicStatement = Omit<StoredStatement, "commissionerId">;
