/** Deterministic checks on meeting records. No model involved. */
import { seatedOn } from "../../src/lib/roster";
import type { CommissionerRecord, StoredMeeting } from "../../src/lib/types";

/** Problems within one meeting record. An empty list means it is consistent. */
export function checkMeeting(meeting: StoredMeeting, roster: CommissionerRecord[]): string[] {
  const problems: string[] = [];
  const byId = new Map(roster.map((r) => [r.id, r]));
  const present = new Set(meeting.attendees);

  const checkPerson = (id: string, where: string) => {
    const record = byId.get(id);
    if (!record) problems.push(`${where}: unknown commissioner "${id}"`);
    else if (!seatedOn(record, meeting.date)) problems.push(`${where}: ${record.name} was not on the board on ${meeting.date}`);
  };

  if (meeting.id !== meeting.date) problems.push(`id "${meeting.id}" does not match date "${meeting.date}"`);
  if (meeting.attendees.length === 0) problems.push("no commissioners listed as present");
  if (new Set(meeting.attendees).size !== meeting.attendees.length) problems.push("attendees contains duplicates");
  meeting.attendees.forEach((id) => checkPerson(id, "attendees"));

  for (const id of Object.keys(meeting.commissionerActivity)) {
    checkPerson(id, "commissionerActivity");
    if (!present.has(id)) problems.push(`commissionerActivity: "${id}" has activity but is not listed as present`);
  }

  meeting.keyVotes.forEach((vote, i) => {
    const where = `vote ${i + 1} ("${vote.description.slice(0, 50)}")`;
    for (const [label, id] of [["mover", vote.mover], ["seconder", vote.seconder]] as const) {
      if (id === null) continue;
      checkPerson(id, `${where} ${label}`);
      if (!present.has(id)) problems.push(`${where}: ${label} "${id}" is not listed as present`);
    }
    if (vote.mover !== null && vote.mover === vote.seconder) problems.push(`${where}: mover and seconder are the same person`);

    if (vote.votes) {
      const { ayes, nays, abstained, absent } = vote.votes;
      const all = [...ayes, ...nays, ...abstained, ...absent];
      all.forEach((id) => checkPerson(id, `${where} roll call`));
      if (new Set(all).size !== all.length) problems.push(`${where}: a commissioner appears more than once in the roll call`);
      for (const id of [...ayes, ...nays, ...abstained]) {
        if (!present.has(id)) problems.push(`${where}: "${id}" voted but is not listed as present`);
      }
      const expected = nays.length === 0 ? "Unanimous" : `${ayes.length}-${nays.length}`;
      if (vote.result !== expected) problems.push(`${where}: result "${vote.result}" does not match the roll call (${expected})`);
      if (vote.passed !== ayes.length > nays.length) problems.push(`${where}: "passed" disagrees with the roll call`);
      if (vote.mover && nays.includes(vote.mover)) problems.push(`${where}: the mover is recorded voting against the motion`);
    }
  });

  const ids = new Set<string>();
  for (const fu of meeting.followUps) {
    if (ids.has(fu.id)) problems.push(`follow-up ${fu.id}: duplicate id`);
    ids.add(fu.id);
    if (!fu.id.startsWith(`${meeting.id}-fu-`)) problems.push(`follow-up ${fu.id}: id must start with "${meeting.id}-fu-"`);
    if (fu.relatedMeetingId !== meeting.id) problems.push(`follow-up ${fu.id}: relatedMeetingId must be "${meeting.id}"`);
    if (fu.dateRaised !== meeting.date) problems.push(`follow-up ${fu.id}: dateRaised must be "${meeting.date}"`);
    const closed = fu.status === "resolved" || fu.status === "dropped";
    if (closed && !fu.resolvedMeetingId) problems.push(`follow-up ${fu.id}: ${fu.status} but no resolvedMeetingId`);
    if (!closed && (fu.resolvedMeetingId || fu.resolvedDate)) problems.push(`follow-up ${fu.id}: ${fu.status} but has resolution fields`);
  }

  return problems;
}

/** Problems across the whole data set, each prefixed with the meeting it belongs to. */
export function checkStoredMeetings(meetings: StoredMeeting[], roster: CommissionerRecord[]): string[] {
  const problems: string[] = [];
  const meetingIds = new Set(meetings.map((m) => m.id));
  for (const meeting of meetings) {
    problems.push(...checkMeeting(meeting, roster).map((p) => `${meeting.id}: ${p}`));
    for (const fu of meeting.followUps) {
      for (const ref of [fu.resolvedMeetingId, fu.lastReferencedMeetingId]) {
        if (!ref) continue;
        if (!meetingIds.has(ref)) problems.push(`${meeting.id}: follow-up ${fu.id} refers to meeting ${ref}, which is not stored`);
        else if (ref < meeting.id) problems.push(`${meeting.id}: follow-up ${fu.id} refers to an earlier meeting (${ref})`);
      }
    }
  }
  return problems;
}
