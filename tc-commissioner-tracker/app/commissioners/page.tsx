"use client";

import Link from "next/link";
import { COMMISSIONERS, CATEGORIES, CATEGORY_ICONS } from "@/lib/constants";
import { useMeetings } from "@/lib/meetings-context";
import type { Meeting } from "@/lib/types";
import TopicRadarChart from "@/components/charts/TopicRadarChart";
import MotionPartnershipMatrix from "@/components/charts/MotionPartnershipMatrix";

function getStats(commissionerId: string, meetings: Meeting[]) {
  let meetingsPresent = 0;
  let topicCount = 0;
  let motionsMade = 0;
  let motionsSeconded = 0;

  for (const meeting of meetings) {
    if (!meeting.attendees.includes(commissionerId)) continue;
    meetingsPresent++;
    const activity = meeting.commissionerActivity[commissionerId];
    if (!activity) continue;
    topicCount += activity.topics.length;
    motionsMade += activity.motionsMade;
    motionsSeconded += activity.motionsSeconded;
  }

  return { meetingsPresent, topicCount, motionsMade, motionsSeconded };
}

function getRoleBadge(role: string) {
  switch (role) {
    case "Chair":
      return { label: "Chairperson", bg: "bg-secondary-fixed", text: "text-on-secondary-fixed" };
    case "Vice-Chair":
      return { label: "Vice-Chair", bg: "bg-tertiary-fixed-dim/30", text: "text-on-tertiary-container" };
    default:
      return { label: "Member", bg: "bg-surface-container", text: "text-on-surface-variant" };
  }
}

function getRecentActions(meetings: Meeting[]) {
  const actions: { date: string; commName: string; commId: string; text: string; categories: string[] }[] = [];

  for (const meeting of meetings) {
    for (const [commId, activity] of Object.entries(meeting.commissionerActivity)) {
      const comm = COMMISSIONERS.find((c) => c.id === commId);
      for (const topic of activity.topics) {
        actions.push({
          date: meeting.date,
          commName: comm?.name.split(" ").pop() ?? commId,
          commId,
          text: topic.text,
          categories: topic.categories,
        });
      }
    }
  }

  return actions.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
}

export default function CommissionersList() {
  const { meetings } = useMeetings();
  const recentActions = getRecentActions(meetings);

  return (
    <div className="px-4 md:px-8 lg:px-12 py-8 md:py-16 space-y-10 md:space-y-16">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="max-w-2xl">
          <h1 className="font-headline text-3xl md:text-5xl lg:text-6xl text-primary font-bold mb-4 tracking-tight leading-none">
            The Board of Commissioners
          </h1>
          <p className="font-body text-lg text-on-surface-variant max-w-xl">
            Current Board of Commissioners — click for full activity profile. Tracking meetings, active topics, and legislative motions.
          </p>
        </div>
      </div>

      {/* Commissioner Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
        {COMMISSIONERS.map((commissioner) => {
          const stats = getStats(commissioner.id, meetings);
          const badge = getRoleBadge(commissioner.role);
          const notRunning = commissioner.id === "dalton" || commissioner.id === "mckelvey";

          return (
            <Link
              key={commissioner.id}
              href={`/commissioners/${commissioner.id}`}
              className="relative bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-5 md:p-8 flex gap-4 shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="w-2 h-16 rounded-full mt-2 shrink-0" style={{ backgroundColor: commissioner.color }} />
              <div className="flex-1">
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`font-label text-[10px] uppercase tracking-widest ${badge.text} ${badge.bg} px-2 py-0.5 rounded`}>
                      {badge.label}
                    </span>
                    {notRunning && (
                      <span className="font-label text-[10px] uppercase tracking-widest text-error bg-error/10 px-2 py-0.5 rounded">
                        Not running &apos;26
                      </span>
                    )}
                  </div>
                  <h2 className="font-headline text-3xl text-primary font-bold">{commissioner.name}</h2>
                  <p className="font-body text-sm text-on-surface-variant">Since {commissioner.since}</p>
                </div>
                <div className="flex gap-8 border-t border-outline-variant/20 pt-6">
                  <div className="flex flex-col">
                    <span className="font-headline text-2xl text-primary">{stats.meetingsPresent}</span>
                    <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-tighter">Meetings</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-headline text-2xl text-primary">{stats.topicCount}</span>
                    <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-tighter">Topics</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-headline text-2xl text-primary">{stats.motionsMade + stats.motionsSeconded}</span>
                    <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-tighter">Motions</span>
                  </div>
                </div>
                <div className="mt-8">
                  <span className="text-primary font-bold text-xs flex items-center gap-2 group-hover:translate-x-1 transition-transform uppercase tracking-wider">
                    View Public Profile <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </span>
                </div>
              </div>
              {/* Mini Radar */}
              <div className="hidden md:flex items-center shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                <TopicRadarChart commissionerId={commissioner.id} meetings={meetings} color={commissioner.color} mini />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Motion Partnership Matrix */}
      <section className="pt-16 border-t border-outline-variant/30 pb-16">
        <h3 className="font-headline text-3xl text-primary font-bold mb-4">Working Relationships</h3>
        <p className="text-sm text-on-surface-variant mb-8">How often each commissioner pair works together on motions — movers (rows) and seconders (columns).</p>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <MotionPartnershipMatrix meetings={meetings} />
        </div>
      </section>

      {/* Recent Actions Ledger */}
      <section className="pt-16 border-t border-outline-variant/30">
        <h3 className="font-headline text-3xl text-primary font-bold mb-10">Recent Actions Ledger</h3>
        <div className="space-y-0">
          {recentActions.map((action, i) => {
            const topCat = action.categories[0];
            const category = CATEGORIES.find((c) => c.id === topCat);
            const icon = topCat ? CATEGORY_ICONS[topCat] : undefined;

            return (
              <div key={i} className="flex flex-col md:grid md:grid-cols-12 gap-1 md:gap-0 py-4 md:py-6 group hover:bg-surface-container-low transition-colors px-4 -mx-4 rounded-lg">
                <div className="md:col-span-2 font-label text-[10px] md:text-xs text-on-surface-variant uppercase md:self-center">
                  {new Date(action.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
                <div className="hidden md:col-span-1 md:flex justify-center">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1" />
                </div>
                <div className="md:col-span-7 font-body text-sm md:text-base text-on-surface">
                  <Link href={`/commissioners/${action.commId}`} className="font-bold hover:underline">
                    {action.commName}
                  </Link>
                  {" "}{action.text.charAt(0).toLowerCase() + action.text.slice(1)}
                </div>
                <div className="md:col-span-2 md:text-right">
                  {category && (
                    <Link
                      href={`/topics/${topCat}`}
                      className="inline-flex items-center gap-1 font-label text-[10px] text-on-secondary-fixed bg-secondary-fixed px-2 py-0.5 rounded uppercase hover:opacity-80 transition-opacity"
                    >
                      {icon && <span className="material-symbols-outlined text-[12px]">{icon}</span>}
                      {category.label}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
