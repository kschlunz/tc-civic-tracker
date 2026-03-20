"use client";

import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { COMMISSIONERS, CATEGORIES, CATEGORY_ICONS } from "@/lib/constants";
import { useMeetings } from "@/lib/meetings-context";
import { parseFiltersFromParams, filterMeetings } from "@/lib/filters";
import { PUBLIC_STATEMENTS } from "@/lib/public-statements";
import CategoryTag from "@/components/CategoryTag";
import FilterBar from "@/components/FilterBar";
import TopicRadarChart from "@/components/charts/TopicRadarChart";
import FollowThroughRate from "@/components/charts/FollowThroughRate";
import ActivitySparkline from "@/components/charts/ActivitySparkline";
import type { FollowUpItem } from "@/lib/types";

const BORDER_COLORS = ["border-primary", "border-secondary", "border-primary-container", "border-tertiary"];
const DOT_COLORS = ["bg-primary", "bg-secondary", "bg-tertiary-container", "bg-outline", "bg-on-primary-container", "bg-error"];

function CommissionerContent() {
  const { id } = useParams<{ id: string }>();
  const commissioner = COMMISSIONERS.find((c) => c.id === id);
  if (!commissioner) notFound();

  const statements = PUBLIC_STATEMENTS[id] || [];
  const { meetings: allMeetings } = useMeetings();
  const searchParams = useSearchParams();
  const filters = parseFiltersFromParams(searchParams);
  const meetings = filterMeetings(allMeetings, { dateRange: filters.dateRange, dateFrom: filters.dateFrom, dateTo: filters.dateTo });

  let meetingsPresent = 0;
  let totalTopics = 0;
  let totalMotionsMade = 0;
  let totalMotionsSeconded = 0;
  const categoryCounts: Record<string, number> = {};
  const meetingActivities: { meetingId: string; date: string; activity: typeof meetings[0]["commissionerActivity"][string] }[] = [];

  for (const meeting of meetings) {
    if (!meeting.attendees.includes(id)) continue;
    meetingsPresent++;
    const activity = meeting.commissionerActivity[id];
    if (!activity) continue;
    totalTopics += activity.topics.length;
    totalMotionsMade += activity.motionsMade;
    totalMotionsSeconded += activity.motionsSeconded;
    for (const topic of activity.topics) {
      for (const cat of topic.categories) {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      }
    }
    meetingActivities.push({ meetingId: meeting.id, date: meeting.date, activity });
  }

  // Gather follow-ups owned by this commissioner
  const myFollowUps: FollowUpItem[] = [];
  for (const m of allMeetings) {
    if (m.followUps) {
      for (const fu of m.followUps) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const owner = fu.owner || (fu as any).raisedBy || "";
        if (owner === id) myFollowUps.push(fu);
      }
    }
  }

  // Load status overrides for follow-through rate
  let fuStatusOverrides: Record<string, string> = {};
  if (typeof window !== "undefined") {
    try { fuStatusOverrides = JSON.parse(localStorage.getItem("tc-followup-status") || "{}"); } catch { /* ignore */ }
  }

  const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  const maxCatCount = sortedCategories[0]?.[1] || 1;

  const metricCards = [
    { label: "Meetings Present", value: meetingsPresent },
    { label: "Topics Raised", value: totalTopics },
    { label: "Motions Made", value: totalMotionsMade },
    { label: "Motions Seconded", value: totalMotionsSeconded },
  ];

  return (
    <div className="px-4 md:px-8 py-8 md:py-12 max-w-6xl mx-auto">
      {/* Hero Header */}
      <section className="mb-10 md:mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6 md:gap-8 border-b border-outline-variant/20 pb-8 md:pb-12">
        <div className="max-w-2xl">
          <span className="text-on-surface-variant font-bold text-xs uppercase tracking-[0.2em] mb-3 md:mb-4 block">Commissioner Profile</span>
          <h1 className="font-headline text-4xl md:text-6xl lg:text-7xl font-bold text-primary leading-tight mb-3 md:mb-4">{commissioner.name}</h1>
          <div className="flex flex-wrap items-center gap-3 md:gap-6">
            <div className="flex items-center">
              <span className="text-lg md:text-2xl italic font-headline text-secondary pr-3 md:pr-4">
                {commissioner.role === "Chair" ? "Board Chair" : commissioner.role}
              </span>
              <div className="h-6 md:h-8 w-px bg-outline-variant/40" />
            </div>
            <p className="text-on-surface-variant font-medium text-sm md:text-base">Serving since {commissioner.since}</p>
          </div>
        </div>
        <div className="hidden md:flex flex-col items-end">
          <div className="h-16 w-32 rounded-sm" style={{ background: `linear-gradient(135deg, ${commissioner.color}, ${commissioner.color}88, ${commissioner.color}44)` }} />
          <p className="text-xs font-bold text-primary uppercase tracking-widest mt-4">District Identity Bar</p>
        </div>
      </section>

      {/* Date Filter */}
      <div className="mb-12">
        <FilterBar dateOnly />
      </div>

      {/* Metrics Bento Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-10 md:mb-16">
        {metricCards.map((stat, i) => (
          <div key={stat.label} className={`bg-surface-container-lowest p-4 md:p-8 ${BORDER_COLORS[i % BORDER_COLORS.length]} border-l-4`}>
            <p className="text-on-surface-variant text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1 md:mb-2">{stat.label}</p>
            <h3 className="text-2xl md:text-4xl font-headline text-primary">{stat.value}</h3>
          </div>
        ))}
      </section>

      {/* Data Visualizations */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-10 md:mb-16">
        {/* Topic Radar */}
        <div className="bg-surface-container-lowest p-4 md:p-6 rounded-lg border border-outline-variant/20">
          <h4 className="font-headline text-lg font-bold text-primary mb-4">Topic Profile</h4>
          <div className="flex justify-center overflow-x-auto">
            <TopicRadarChart commissionerId={id} meetings={meetings} color={commissioner.color} />
          </div>
        </div>

        {/* Follow-Through Rate */}
        <FollowThroughRate followUps={myFollowUps} statusOverrides={fuStatusOverrides} />

        {/* Activity Sparkline */}
        <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant/20">
          <h4 className="font-headline text-lg font-bold text-primary mb-4">Engagement Over Time</h4>
          <ActivitySparkline commissionerId={id} meetings={allMeetings} color={commissioner.color} />
          {allMeetings.filter((m) => m.attendees.includes(id)).length < 2 && (
            <p className="text-[10px] text-on-surface-variant italic mt-2">Requires 2+ meetings to display</p>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 md:gap-16">
        {/* Left Column */}
        <div className="lg:col-span-5 space-y-12">
          <div>
            <h2 className="font-headline text-3xl font-bold mb-8 flex items-center gap-3">
              <span className="w-8 h-px bg-primary" /> Focus Areas
            </h2>
            <div className="space-y-6">
              {sortedCategories.length === 0 && (
                <p className="text-on-surface-variant text-sm italic">No activity in the selected time period.</p>
              )}
              {sortedCategories.map(([catId, count]) => {
                const category = CATEGORIES.find((c) => c.id === catId);
                if (!category) return null;
                const pct = Math.round((count / maxCatCount) * 100);
                return (
                  <Link key={catId} href={`/topics/${catId}`} className="block space-y-2 group">
                    <div className="flex justify-between items-end">
                      <span className="text-sm font-bold text-primary group-hover:underline">{category.label}</span>
                      <span className="text-xs font-medium text-on-surface-variant">{count} {count === 1 ? "Item" : "Items"}</span>
                    </div>
                    <div className="h-2 w-full bg-surface-container-high overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${pct}%`, opacity: 0.5 + (pct / 100) * 0.5 }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="bg-surface-container-low p-8 border border-outline-variant/10">
            <h2 className="font-headline text-2xl font-bold mb-6">Latest Statements</h2>
            <ul className="space-y-8">
              {statements
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((stmt, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="material-symbols-outlined text-secondary shrink-0">{stmt.type === "news" ? "newspaper" : "mic"}</span>
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-sm font-bold">{stmt.source}</p>
                        <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">
                          {new Date(stmt.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                      <p className="text-sm text-on-surface-variant leading-relaxed">{stmt.text}</p>
                      {stmt.url && (
                        <a href={stmt.url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-primary uppercase tracking-wider mt-2 inline-flex items-center gap-1 hover:underline">
                          Read article <span className="material-symbols-outlined text-xs">arrow_forward</span>
                        </a>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {stmt.categories.map((catId) => <CategoryTag key={catId} id={catId} />)}
                      </div>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        </div>

        {/* Right Column: Activity Ledger */}
        <div className="lg:col-span-7">
          <div className="flex justify-between items-center mb-10">
            <h2 className="font-headline text-3xl font-bold italic">Activity Ledger</h2>
          </div>

          {meetingActivities.length === 0 && (
            <p className="text-on-surface-variant text-sm italic py-8">No meeting activity in the selected time period.</p>
          )}

          {meetingActivities
            .sort((a, b) => b.date.localeCompare(a.date))
            .map(({ meetingId, date, activity }) => (
              <div key={meetingId} className="mb-12">
                <Link
                  href={`/meetings/${meetingId}`}
                  className="inline-block text-sm font-bold px-3 py-1 bg-secondary-fixed text-on-secondary-fixed rounded-full mb-6 hover:opacity-80 transition-opacity"
                >
                  {new Date(date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </Link>
                <div className="relative pl-8">
                  <div className="absolute left-0 top-0 bottom-0 w-px bg-outline-variant/30" />
                  <div className="space-y-12">
                    {activity.topics.map((topic, i) => (
                      <div key={i} className="relative">
                        <div className={`absolute -left-[36px] top-1.5 w-4 h-4 rounded-full ${DOT_COLORS[i % DOT_COLORS.length]} ring-4 ring-surface`} />
                        <div className="bg-surface-container-lowest p-8 shadow-sm transition-transform hover:-translate-y-1">
                          <p className="text-on-surface-variant text-sm leading-relaxed mb-4">{topic.text}</p>
                          <div className="flex gap-2 flex-wrap">
                            {topic.categories.map((catId) => {
                              const cat = CATEGORIES.find((c) => c.id === catId);
                              const icon = CATEGORY_ICONS[catId];
                              if (!cat) return null;
                              return (
                                <Link key={catId} href={`/topics/${catId}`} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 border border-outline-variant/20 text-on-surface-variant uppercase hover:bg-surface-container-high transition-colors">
                                  {icon && <span className="material-symbols-outlined text-[12px]">{icon}</span>}
                                  {cat.label}
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export default function CommissionerDetail() {
  return (
    <Suspense>
      <CommissionerContent />
    </Suspense>
  );
}
