/**
 * "What happened at the meeting" digests, built directly from the stored
 * record (no model call). Experimental: nothing publishes these yet.
 */
import { toMeeting } from "../../src/lib/derive";
import type { CommissionerRecord, StoredMeeting } from "../../src/lib/types";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function longDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export interface Digest {
  subject: string;
  text: string;
  html: string;
}

export interface DigestContext {
  roster: CommissionerRecord[];
  /** Follow-ups from earlier meetings that this meeting moved, with their descriptions. */
  allMeetings: StoredMeeting[];
  /** Public address of the site, no trailing slash. */
  siteUrl: string;
}

interface DigestSection {
  heading: string;
  items: string[];
}

function sections(meeting: StoredMeeting, context: DigestContext): DigestSection[] {
  const name = (id: string) => context.roster.find((r) => r.id === id)?.name ?? id;
  const votes = meeting.keyVotes.filter((v) => !v.consent);
  const split = votes.filter((v) => !v.passed || (v.votes && v.votes.nays.length > 0));
  const routine = votes.filter((v) => !split.includes(v));
  const out: DigestSection[] = [];

  if (split.length > 0) {
    out.push({
      heading: "Contested votes",
      items: split.map((v) => {
        const against = v.votes?.nays.length ? ` Against: ${v.votes.nays.map(name).join(", ")}.` : "";
        return `${v.description} — ${v.passed ? "passed" : "failed"} ${v.result === "Passed" || v.result === "Failed" ? "" : v.result}`.trim() + `.${against}`;
      }),
    });
  }
  if (routine.length > 0) {
    out.push({ heading: "Also approved", items: routine.map((v) => v.description) });
  }
  if (meeting.followUps.length > 0) {
    out.push({
      heading: "New commitments to watch",
      items: meeting.followUps.map((f) => `${f.description} (${context.roster.some((r) => r.id === f.owner) ? name(f.owner) : f.owner === "staff" ? "county staff" : f.owner})`),
    });
  }
  const moved = context.allMeetings
    .flatMap((m) => m.followUps)
    .filter((f) => f.relatedMeetingId !== meeting.id && (f.resolvedMeetingId === meeting.id || f.lastReferencedMeetingId === meeting.id));
  if (moved.length > 0) {
    out.push({
      heading: "Earlier commitments updated",
      items: moved.map((f) => `${f.description} — ${f.status.replace("_", " ")}${f.resolution ? `: ${f.resolution}` : ""}`),
    });
  }
  if (meeting.publicComments.length > 0) {
    out.push({ heading: "Public comment", items: meeting.publicComments.map((c) => `${c.speaker}: ${c.summary}`) });
  }
  return out;
}

export function buildDigest(meeting: StoredMeeting, context: DigestContext): Digest {
  const title = `County commissioners, ${longDate(meeting.date)}`;
  const link = `${context.siteUrl}/meetings/${meeting.id}`;
  const body = sections(meeting, context);
  const present = toMeeting(meeting).attendees.length;

  const text = [
    title,
    "",
    meeting.tldr,
    "",
    ...body.flatMap((s) => [s.heading.toUpperCase(), ...s.items.map((i) => `- ${i}`), ""]),
    `${present} commissioners present. Full record: ${link}`,
    `Official minutes: ${meeting.sourceUrl}`,
    "",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:24px;background:#f6f4ef;font-family:Georgia,serif;color:#1c1c1a;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;padding:32px;border-top:4px solid #2d5a3d;">
<p style="margin:0 0 4px;font:bold 11px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#6b6b63;">Civic Ledger · Transylvania County</p>
<h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;">${escapeHtml(title)}</h1>
<p style="font-size:17px;line-height:1.5;">${escapeHtml(meeting.tldr)}</p>
${body
  .map(
    (s) => `<h2 style="margin:28px 0 8px;font:bold 12px Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:#2d5a3d;">${escapeHtml(s.heading)}</h2>
<ul style="margin:0;padding-left:20px;font-size:15px;line-height:1.5;">
${s.items.map((i) => `<li style="margin-bottom:6px;">${escapeHtml(i)}</li>`).join("\n")}
</ul>`,
  )
  .join("\n")}
<p style="margin:32px 0 0;font:14px Arial,sans-serif;"><a href="${escapeHtml(link)}" style="color:#2d5a3d;font-weight:bold;">Read the full record</a> · <a href="${escapeHtml(meeting.sourceUrl)}" style="color:#2d5a3d;">Official minutes (PDF)</a></p>
<p style="margin:16px 0 0;font:12px Arial,sans-serif;color:#6b6b63;">Drawn from the county's official minutes with AI-assisted processing. The minutes are the official record.</p>
</div></body></html>
`;

  return { subject: title, text, html };
}

/** RSS 2.0 feed of the most recent meetings, newest first. */
export function buildFeed(meetings: StoredMeeting[], context: DigestContext, limit = 20): string {
  const recent = [...meetings].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
  const items = recent.map((meeting) => {
    const digest = buildDigest(meeting, context);
    const link = `${context.siteUrl}/meetings/${meeting.id}`;
    return `    <item>
      <title>${escapeHtml(digest.subject)}</title>
      <link>${escapeHtml(link)}</link>
      <guid isPermaLink="true">${escapeHtml(link)}</guid>
      <pubDate>${new Date(`${meeting.date}T22:00:00Z`).toUTCString()}</pubDate>
      <description>${escapeHtml(digest.text)}</description>
    </item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Civic Ledger — Transylvania County Commissioners</title>
    <link>${escapeHtml(context.siteUrl)}</link>
    <description>What the Transylvania County Board of Commissioners decided, meeting by meeting.</description>
    <language>en-us</language>
${items.join("\n")}
  </channel>
</rss>
`;
}
