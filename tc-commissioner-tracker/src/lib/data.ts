import type { Meeting, FollowUpItem, PublicStatement } from "./types";
import { supabase, isSupabaseEnabled } from "./supabase";

// ============================================
// LOCAL JSON FALLBACK
// ============================================
import meeting_2026_02_09 from "@/data/meetings/2026-02-09.json";

const LOCAL_MEETINGS: Meeting[] = [
  meeting_2026_02_09 as Meeting,
];

// ============================================
// SUPABASE → MEETING TYPE MAPPER
// ============================================
function dbRowToMeeting(row: Record<string, unknown>): Meeting {
  return {
    id: row.id as string,
    date: (row.date as string).slice(0, 10),
    type: (row.type as string) || "regular",
    time: (row.time as string) || "",
    attendees: (row.attendees as string[]) || [],
    audienceSize: (row.audience_size as number) || 0,
    duration: (row.duration as string) || "",
    tldr: (row.tldr as string) || "",
    keyVotes: (row.key_votes as Meeting["keyVotes"]) || [],
    commissionerActivity: (row.commissioner_activity as Meeting["commissionerActivity"]) || {},
    publicComments: (row.public_comments as Meeting["publicComments"]) || [],
    followUps: (row.follow_ups as FollowUpItem[]) || [],
    sourceUrl: (row.source_url as string) || undefined,
    agendaUrl: (row.agenda_url as string) || undefined,
  };
}

function dbRowToFollowUp(row: Record<string, unknown>): FollowUpItem {
  return {
    id: row.id as string,
    dateRaised: (row.date_raised as string).slice(0, 10),
    owner: (row.owner as string) || "staff",
    description: (row.description as string) || "",
    status: (row.status as FollowUpItem["status"]) || "open",
    categories: (row.categories as string[]) || [],
    relatedMeetingId: (row.related_meeting_id as string) || "",
    resolvedDate: row.resolved_date ? (row.resolved_date as string).slice(0, 10) : undefined,
    resolvedMeetingId: (row.resolved_meeting_id as string) || undefined,
    resolution: (row.resolution as string) || undefined,
    lastReferencedMeetingId: (row.last_referenced_meeting_id as string) || undefined,
  };
}

function dbRowToStatement(row: Record<string, unknown>): { commissionerId: string; statement: PublicStatement } {
  return {
    commissionerId: row.commissioner_id as string,
    statement: {
      date: (row.date as string).slice(0, 10),
      source: (row.source as string) || "",
      type: (row.type as PublicStatement["type"]) || "statement",
      text: (row.text as string) || "",
      url: (row.url as string) || undefined,
      categories: (row.categories as string[]) || [],
    },
  };
}

// ============================================
// PUBLIC API — same signatures, Supabase or local
// ============================================

/** Returns all meetings, sorted by date descending */
export async function getMeetingsAsync(): Promise<Meeting[]> {
  if (isSupabaseEnabled()) {
    const { data, error } = await supabase!
      .from("meetings")
      .select("*")
      .order("date", { ascending: false });

    if (error) {
      console.error("Supabase getMeetings error:", error);
      return getLocalMeetings();
    }
    return (data || []).map(dbRowToMeeting);
  }
  return getLocalMeetings();
}

/** Returns a single meeting by ID */
export async function getMeetingAsync(id: string): Promise<Meeting | undefined> {
  if (isSupabaseEnabled()) {
    const { data, error } = await supabase!
      .from("meetings")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return getLocalMeeting(id);
    return dbRowToMeeting(data);
  }
  return getLocalMeeting(id);
}

/** Returns all follow-up items, sorted by date descending */
export async function getFollowUpsAsync(): Promise<FollowUpItem[]> {
  if (isSupabaseEnabled()) {
    const { data, error } = await supabase!
      .from("follow_ups")
      .select("*")
      .order("date_raised", { ascending: false });

    if (error) {
      console.error("Supabase getFollowUps error:", error);
      return getLocalFollowUps();
    }
    return (data || []).map(dbRowToFollowUp);
  }
  return getLocalFollowUps();
}

/** Returns all public statements grouped by commissioner */
export async function getPublicStatementsAsync(): Promise<Record<string, PublicStatement[]>> {
  if (isSupabaseEnabled()) {
    const { data, error } = await supabase!
      .from("public_statements")
      .select("*")
      .order("date", { ascending: false });

    if (error) {
      console.error("Supabase getPublicStatements error:", error);
      return getLocalPublicStatements();
    }

    const result: Record<string, PublicStatement[]> = {};
    for (const row of data || []) {
      const { commissionerId, statement } = dbRowToStatement(row);
      if (!result[commissionerId]) result[commissionerId] = [];
      result[commissionerId].push(statement);
    }
    return result;
  }
  return getLocalPublicStatements();
}

// ============================================
// SYNCHRONOUS LOCAL ACCESSORS (for SSR / context init)
// ============================================

export function getMeetings(): Meeting[] {
  return getLocalMeetings();
}

export function getMeeting(id: string): Meeting | undefined {
  return getLocalMeeting(id);
}

export function getFollowUps(): FollowUpItem[] {
  return getLocalFollowUps();
}

// ============================================
// LOCAL DATA HELPERS
// ============================================

function getLocalMeetings(): Meeting[] {
  const deduped = new Map<string, Meeting>();
  for (const m of LOCAL_MEETINGS) {
    deduped.set(m.id, m);
  }
  return Array.from(deduped.values()).sort((a, b) => b.date.localeCompare(a.date));
}

function getLocalMeeting(id: string): Meeting | undefined {
  return LOCAL_MEETINGS.find((m) => m.id === id);
}

function getLocalFollowUps(): FollowUpItem[] {
  const items: FollowUpItem[] = [];
  for (const m of LOCAL_MEETINGS) {
    if (m.followUps) {
      items.push(...m.followUps);
    }
  }
  return items.sort((a, b) => b.dateRaised.localeCompare(a.dateRaised));
}

function getLocalPublicStatements(): Record<string, PublicStatement[]> {
  // Import from the existing public-statements file
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PUBLIC_STATEMENTS } = require("./public-statements");
    return PUBLIC_STATEMENTS;
  } catch {
    return {};
  }
}
