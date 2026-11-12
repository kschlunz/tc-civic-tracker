import type { Meeting, StoredMeeting } from "./types";

/**
 * Turn a stored meeting into the shape the app uses. Motion counts are counted
 * from the recorded votes rather than stored, so they can never disagree.
 */
export function toMeeting(stored: StoredMeeting): Meeting {
  const commissionerActivity: Meeting["commissionerActivity"] = {};
  for (const id of new Set([...stored.attendees, ...Object.keys(stored.commissionerActivity)])) {
    const activity = stored.commissionerActivity[id] ?? { topics: [], externalRoles: [] };
    commissionerActivity[id] = {
      ...activity,
      motionsMade: stored.keyVotes.filter((v) => v.mover === id).length,
      motionsSeconded: stored.keyVotes.filter((v) => v.seconder === id).length,
    };
  }
  return { ...stored, commissionerActivity };
}

/** "Unanimous" or "4-1", worked out from the roll call. */
export function voteResultLabel(ayes: number, nays: number): string {
  return nays === 0 ? "Unanimous" : `${ayes}-${nays}`;
}
