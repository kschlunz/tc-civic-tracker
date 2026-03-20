"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { COMMISSIONERS, CATEGORIES, CATEGORY_ICONS, ELECTION_INFO } from "@/lib/constants";
import { useMeetings } from "@/lib/meetings-context";
import { parseFiltersFromParams, filterMeetings } from "@/lib/filters";
import FilterBar from "@/components/FilterBar";
import type { FollowUpItem } from "@/lib/types";

function getCommissionerStats(commissionerId: string, meetings: ReturnType<typeof useMeetings>["meetings"]) {
  let topicCount = 0;
  let motionsMade = 0;
  let motionsSeconded = 0;
  let meetingsPresent = 0;

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

function getTopicCounts(meetings: ReturnType<typeof useMeetings>["meetings"]) {
  const counts: Record<string, number> = {};
  for (const meeting of meetings) {
    for (const activity of Object.values(meeting.commissionerActivity)) {
      for (const topic of activity.topics) {
        for (const cat of topic.categories) {
          counts[cat] = (counts[cat] || 0) + 1;
        }
      }
    }
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function getTotalActions(meetings: ReturnType<typeof useMeetings>["meetings"]) {
  let total = 0;
  for (const meeting of meetings) {
    for (const activity of Object.values(meeting.commissionerActivity)) {
      total += activity.topics.length;
    }
  }
  return total;
}

function getOwnerDisplayName(owner: string) {
  const commissioner = COMMISSIONERS.find((c) => c.id === owner);
  if (commissioner) return commissioner.name;
  if (owner === "staff") return "County Staff";
  return owner;
}

function daysSince(dateStr: string) {
  const raised = new Date(dateStr + "T12:00:00");
  const now = new Date();
  return Math.floor((now.getTime() - raised.getTime()) / (1000 * 60 * 60 * 24));
}

function getDaysColor(days: number) {
  if (days > 120) return "text-error";
  if (days >= 60) return "text-amber-600";
  return "text-on-surface-variant";
}

function OpenItemsSummary({ meetings }: { meetings: ReturnType<typeof useMeetings>["meetings"] }) {
  const allFollowUps: FollowUpItem[] = [];
  for (const m of meetings) {
    if (m.followUps) {
      allFollowUps.push(...m.followUps);
    }
  }

  // Apply localStorage overrides
  let statusOverrides: Record<string, string> = {};
  if (typeof window !== "undefined") {
    try {
      statusOverrides = JSON.parse(localStorage.getItem("tc-followup-status") || "{}");
    } catch { /* ignore */ }
  }

  const getStatus = (item: FollowUpItem) => statusOverrides[item.id] || item.status;
  const openItems = allFollowUps.filter((f) => {
    const s = getStatus(f);
    return s === "open" || s === "in_progress";
  });
  const resolvedCount = allFollowUps.length - openItems.length;

  if (openItems.length === 0) return null;

  // Sort by days open descending, take top 5
  const topItems = [...openItems]
    .sort((a, b) => a.dateRaised.localeCompare(b.dateRaised))
    .slice(0, 5);

  return (
    <section>
      <div className="flex items-end justify-between border-b border-outline-variant/30 pb-4 mb-8">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-error">pending_actions</span>
          <h2 className="font-headline text-3xl">Accountability Tracker</h2>
        </div>
        <span className="text-xs font-label font-bold text-on-surface-variant uppercase tracking-wider">
          {openItems.length} open · {resolvedCount} resolved
        </span>
      </div>
      <div className="space-y-2">
        {topItems.map((item) => {
          const days = daysSince(item.dateRaised);
          const daysColor = getDaysColor(days);
          return (
            <Link
              key={item.id}
              href="/follow-ups"
              className="flex items-center gap-4 bg-surface-container-lowest border border-outline-variant/20 p-4 rounded-lg hover:bg-surface-container-low transition-colors"
            >
              <span className={`text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${daysColor}`}>
                {days}d
              </span>
              <p className="text-sm text-on-surface font-medium truncate flex-1">{item.description}</p>
              <span className="text-xs text-on-surface-variant font-bold whitespace-nowrap shrink-0 hidden md:inline">
                {getOwnerDisplayName(item.owner)}
              </span>
              <div className="flex gap-1 shrink-0">
                {item.categories.slice(0, 1).map((catId) => {
                  const cat = CATEGORIES.find((c) => c.id === catId);
                  const icon = CATEGORY_ICONS[catId];
                  if (!cat) return null;
                  return (
                    <span
                      key={catId}
                      className="inline-flex items-center gap-1 bg-secondary-fixed text-on-secondary-fixed px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                    >
                      {icon && <span className="material-symbols-outlined text-[12px]">{icon}</span>}
                      {cat.label}
                    </span>
                  );
                })}
              </div>
            </Link>
          );
        })}
      </div>
      <div className="mt-4">
        <Link
          href="/follow-ups"
          className="text-xs font-bold uppercase tracking-widest text-primary hover:opacity-70 transition-opacity flex items-center gap-1"
        >
          View all open items
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      </div>
    </section>
  );
}

function DashboardContent() {
  const { meetings: allMeetings } = useMeetings();
  const searchParams = useSearchParams();
  const filters = parseFiltersFromParams(searchParams);
  const meetings = filterMeetings(allMeetings, filters);

  const topicCounts = getTopicCounts(meetings);
  const maxTopicCount = topicCounts[0]?.[1] || 1;
  const totalActions = getTotalActions(meetings);

  const topTopics = topicCounts.slice(0, 6);
  const remainingTopics = topicCounts.slice(6);

  const stats = [
    { label: "Activity Monitor", sublabel: "Meetings Tracked", value: meetings.length, barWidth: `${Math.min(100, (meetings.length / Math.max(allMeetings.length, 1)) * 100)}%` },
    { label: "Legislative Body", sublabel: "Commissioners", value: COMMISSIONERS.length, barWidth: "100%" },
    { label: "Data Taxonomy", sublabel: "Topic Categories", value: CATEGORIES.length, barWidth: "75%" },
    { label: "History Log", sublabel: "Actions Logged", value: totalActions, barWidth: "50%" },
  ];

  return (
    <div className="px-4 md:px-8 lg:px-12 py-8 md:py-12 space-y-10 md:space-y-16">
      {/* Hero Banner */}
      <section className="border-b border-outline-variant/30 pb-12">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-12">
          <div className="flex-1 space-y-8">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-primary/5 px-3 py-1 rounded-full border border-primary/10">
                <span className="w-2 h-2 bg-primary rounded-full pulse" />
                <span className="font-label text-[10px] font-bold uppercase tracking-widest text-primary">Live Ledger</span>
              </div>
              <span className="text-[10px] font-label font-bold text-on-surface-variant/60 uppercase tracking-widest">
                Last Updated: {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
            <div className="inline-flex items-center gap-3">
              <div className="h-px w-8 bg-primary/30" />
              <span className="font-label text-xs uppercase tracking-[0.3em] text-primary font-bold">Curated Intelligence</span>
            </div>
            <div className="max-w-4xl">
              <h1 className="font-headline text-4xl md:text-6xl lg:text-7xl xl:text-8xl text-primary leading-[0.95] font-bold -tracking-wider">
                The State of <br />
                <span className="serif-italic font-normal italic pr-2">Civic Governance.</span>
              </h1>
              <p className="font-body text-xl text-on-surface-variant mt-8 max-w-2xl leading-relaxed opacity-90">
                A real-time ledger of commissioner engagement, legislative activity, and public accountability within Transylvania County.
              </p>
            </div>
          </div>

          {/* Election Card */}
          <div className="w-full lg:w-[340px] shrink-0 bg-primary-container text-on-primary-container p-8 rounded-xl border border-primary/20 shadow-xl relative overflow-hidden group">
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <span className="font-label text-[10px] uppercase tracking-widest text-primary-fixed-dim/80 mb-4 block font-extrabold">Priority Brief</span>
                <h3 className="font-headline text-3xl font-bold leading-tight text-white mb-4">
                  {ELECTION_INFO.nextElection} — {ELECTION_INFO.openSeats} Open Seats
                </h3>
                <p className="text-sm font-body text-primary-fixed-dim leading-relaxed mb-4">
                  {ELECTION_INFO.note}
                </p>
                <div className="space-y-2 text-sm text-primary-fixed-dim mb-8">
                  <p><span className="font-bold text-primary-fixed">GOP:</span> {ELECTION_INFO.gopNominees.join(", ")}</p>
                  <p><span className="font-bold text-primary-fixed">Dem:</span> {ELECTION_INFO.demNominees.join(", ")}</p>
                </div>
              </div>
              <Link
                href="/commissioners"
                className="text-primary-fixed font-bold text-xs uppercase tracking-widest flex items-center gap-2 group-hover:gap-3 transition-all underline decoration-primary-fixed/30 underline-offset-8"
              >
                Review Candidates
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </Link>
            </div>
            <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <FilterBar />

      {/* Stats Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-surface-container-low p-6 rounded-lg transition-all hover:bg-surface-container-high">
            <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-2">{stat.label}</p>
            <div className="flex items-baseline gap-2">
              <h3 className="font-headline text-4xl">{stat.value}</h3>
              <span className="font-body text-sm text-on-surface-variant font-medium">{stat.sublabel}</span>
            </div>
            <div className="mt-4 h-1 w-full bg-outline-variant/20 rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: stat.barWidth }} />
            </div>
          </div>
        ))}
      </section>

      {/* Commissioners + Topics two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
        <div className="xl:col-span-7 space-y-8">
          <div className="flex justify-between items-end border-b border-outline-variant/30 pb-4">
            <h2 className="font-headline text-3xl">Commissioners Overview</h2>
            <Link href="/commissioners" className="text-[10px] font-bold uppercase tracking-widest text-primary border-b border-primary hover:opacity-70 transition-opacity">
              View Full Dossiers
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {COMMISSIONERS.map((commissioner, i) => {
              const cStats = getCommissionerStats(commissioner.id, meetings);
              const notRunning = commissioner.id === "dalton" || commissioner.id === "mckelvey";
              const isLast = i === COMMISSIONERS.length - 1 && COMMISSIONERS.length % 2 !== 0;
              return (
                <Link
                  key={commissioner.id}
                  href={`/commissioners/${commissioner.id}`}
                  className={`bg-surface-container-lowest p-5 rounded relative overflow-hidden flex flex-col justify-between group ${isLast ? "md:col-span-2" : ""}`}
                >
                  <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: commissioner.color }} />
                  <div className={isLast ? "flex flex-col md:flex-row md:items-center justify-between" : ""}>
                    <div>
                      <div className="flex items-center gap-3">
                        <h4 className="font-headline text-xl">{commissioner.name}</h4>
                        {notRunning && (
                          <span className="bg-error/10 text-error text-[8px] px-2 py-0.5 rounded-full font-bold uppercase">
                            Not running &apos;26
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant mb-4">
                        {commissioner.role === "Chair" ? "Board Chair" : commissioner.role}
                      </p>
                    </div>
                    <div className={`grid ${isLast ? "grid-cols-3 gap-12" : "grid-cols-3 gap-2"} py-2`}>
                      <div className="text-center">
                        <p className={`font-headline ${isLast ? "text-2xl" : "text-xl"}`}>{cStats.meetingsPresent}</p>
                        <p className="text-[8px] uppercase font-bold text-secondary">Meetings</p>
                      </div>
                      <div className="text-center">
                        <p className={`font-headline ${isLast ? "text-2xl" : "text-xl"}`}>{cStats.topicCount}</p>
                        <p className="text-[8px] uppercase font-bold text-secondary">Topics</p>
                      </div>
                      <div className="text-center">
                        <p className={`font-headline ${isLast ? "text-2xl" : "text-xl"}`}>{cStats.motionsMade + cStats.motionsSeconded}</p>
                        <p className="text-[8px] uppercase font-bold text-secondary">Motions</p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Most Active Topics */}
        <div className="xl:col-span-5 space-y-8">
          <div className="flex items-end border-b border-outline-variant/30 pb-4">
            <h2 className="font-headline text-3xl">Most Active Topics</h2>
          </div>
          <div className="space-y-4">
            {topTopics.map(([catId, count]) => {
              const materialIcon = CATEGORY_ICONS[catId];
              const category = CATEGORIES.find((c) => c.id === catId);
              if (!category) return null;
              const pct = Math.round((count / maxTopicCount) * 100);
              return (
                <Link key={catId} href={`/topics/${catId}`} className="block space-y-1 group">
                  <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-tight">
                    <span className="flex items-center gap-2 group-hover:text-primary transition-colors">
                      {materialIcon && <span className="material-symbols-outlined text-[14px]">{materialIcon}</span>}
                      {category.label}
                    </span>
                    <span>{count}</span>
                  </div>
                  <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${pct}%`, opacity: 0.4 + (pct / 100) * 0.6 }}
                    />
                  </div>
                </Link>
              );
            })}
            {remainingTopics.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-4">
                {remainingTopics.map(([catId, count]) => {
                  const category = CATEGORIES.find((c) => c.id === catId);
                  if (!category) return null;
                  return (
                    <Link
                      key={catId}
                      href={`/topics/${catId}`}
                      className="rounded-full px-3 py-1 bg-secondary-fixed text-on-secondary-fixed text-[10px] font-bold uppercase hover:opacity-80 transition-opacity"
                    >
                      {category.label} ({count})
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Accountability Tracker — Open Items */}
      <OpenItemsSummary meetings={meetings} />

      {/* Recent Meetings */}
      <section>
        <div className="flex items-end border-b border-outline-variant/30 pb-4 mb-8">
          <h2 className="font-headline text-3xl">Recent Meetings</h2>
        </div>
        <div className="space-y-6">
          {meetings
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 5)
            .map((meeting) => (
              <Link
                key={meeting.id}
                href={`/meetings/${meeting.id}`}
                className="block bg-surface-container-low p-8 rounded relative border-l-4 border-primary hover:bg-surface-container transition-colors"
              >
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="md:w-1/4">
                    <p className="font-headline text-2xl text-primary">
                      {new Date(meeting.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                    <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-on-surface-variant mt-2 capitalize">
                      {meeting.type} Meeting
                    </p>
                    <div className="mt-4 flex items-center gap-2 text-primary font-bold">
                      <span className="material-symbols-outlined text-[18px]">timer</span>
                      <span className="text-sm">{meeting.duration}</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <h3 className="font-headline text-xl italic">
                      Board of Commissioners {meeting.type.charAt(0).toUpperCase() + meeting.type.slice(1)} Meeting
                    </h3>
                    <p className="font-body text-sm leading-relaxed text-on-surface-variant line-clamp-3">
                      {meeting.tldr}
                    </p>
                    <div className="flex items-center gap-2 pt-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
                        {meeting.attendees.length} commissioners · ~{meeting.audienceSize} audience · {meeting.keyVotes.length} votes
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          {meetings.length === 0 && (
            <p className="text-on-surface-variant text-sm italic py-8 text-center">No meetings match the current filters.</p>
          )}
        </div>
      </section>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}
