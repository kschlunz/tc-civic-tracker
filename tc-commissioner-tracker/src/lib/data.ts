import type { FollowUpItem, Meeting, StoredMeeting } from "./types";
import { toMeeting } from "./derive";
// Built from src/data/meetings/*.json by `npm run data` (runs before dev, build, lint and test).
import storedMeetings from "@/data/generated/meetings.json";

const MEETINGS: Meeting[] = (storedMeetings as StoredMeeting[])
  .map(toMeeting)
  .sort((a, b) => b.date.localeCompare(a.date));

/** All meetings, newest first. */
export function getMeetings(): Meeting[] {
  return MEETINGS;
}

export function getMeeting(id: string): Meeting | undefined {
  return MEETINGS.find((m) => m.id === id);
}

/** Every follow-up item, newest first. Each lives in the file of the meeting that raised it. */
export function getFollowUps(meetings: Meeting[] = MEETINGS): FollowUpItem[] {
  return meetings.flatMap((m) => m.followUps).sort((a, b) => b.dateRaised.localeCompare(a.dateRaised));
}
