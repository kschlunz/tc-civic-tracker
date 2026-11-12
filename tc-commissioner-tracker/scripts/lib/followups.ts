/** Carrying follow-up items forward from meeting to meeting. */
import type { FollowUpItem, StoredMeeting } from "../../src/lib/types";
import type { Extraction, OpenFollowUp } from "./extraction";

/** Open and in-progress items raised before the given meeting date. */
export function openFollowUpsBefore(meetings: StoredMeeting[], date: string): OpenFollowUp[] {
  return meetings
    .filter((m) => m.date < date)
    .flatMap((m) => m.followUps)
    .filter((f) => f.status === "open" || f.status === "in_progress")
    .map(({ id, dateRaised, owner, description, status }) => ({ id, dateRaised, owner, description, status }));
}

/**
 * Record what a meeting did to earlier follow-ups. Mutates the earlier
 * meetings and returns the ones that changed.
 */
export function applyFollowUpUpdates(meetings: StoredMeeting[], meetingId: string, updates: Extraction["followUpUpdates"]): StoredMeeting[] {
  const changed = new Set<StoredMeeting>();
  for (const update of updates) {
    for (const meeting of meetings) {
      const item = meeting.followUps.find((f) => f.id === update.id);
      if (!item || meeting.id >= meetingId) continue;
      item.status = update.status;
      item.resolution = update.resolution;
      item.lastReferencedMeetingId = meetingId;
      if (update.status === "resolved" || update.status === "dropped") {
        item.resolvedMeetingId = meetingId;
        item.resolvedDate = meetingId;
      }
      changed.add(meeting);
    }
  }
  return [...changed];
}

function reopen(item: FollowUpItem): void {
  item.status = "open";
  delete item.resolution;
  delete item.resolvedDate;
  delete item.resolvedMeetingId;
  delete item.lastReferencedMeetingId;
}

/**
 * Undo everything meetings on or after `fromId` did to earlier follow-ups, so
 * those meetings can be extracted again from a clean state. Mutates and
 * returns the meetings that changed.
 */
export function undoFollowUpUpdatesFrom(meetings: StoredMeeting[], fromId: string): StoredMeeting[] {
  const changed = new Set<StoredMeeting>();
  for (const meeting of meetings) {
    for (const item of meeting.followUps) {
      const touchedBy = item.resolvedMeetingId ?? item.lastReferencedMeetingId;
      if (touchedBy && touchedBy >= fromId) {
        reopen(item);
        changed.add(meeting);
      }
    }
  }
  return [...changed];
}
