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

const DOT_COLORS = [
  "bg-primary", "bg-secondary", "bg-secondary-fixed-dim",
  "bg-outline-variant", "bg-tertiary-container", "bg-on-primary-container",
];
const BAR_COLORS = [
  "bg-primary", "bg-secondary", "bg-secondary-fixed-dim", "bg-surface-dim", "bg-outline",
];

function TopicContent() {
  const { id } = useParams<{ id: string }>();
  const category = CATEGORIES.find((c) => c.id === id);
  if (!category) notFound();

  const materialIcon = CATEGORY_ICONS[id];
  const { meetings: allMeetings } = useMeetings();
  const searchParams = useSearchParams();
  const filters = parseFiltersFromParams(searchParams);
  const meetings = filterMeetings(allMeetings, { dateRange: filters.dateRange, dateFrom: filters.dateFrom, dateTo: filters.dateTo });

  const commissionerCounts: Record<string, number> = {};
  const timeline: { commissionerId: string; date: string; text: string; meetingId: string }[] = [];
  const coCategories: Record<string, number> = {};

  for (const meeting of meetings) {
    for (const [commId, activity] of Object.entries(meeting.commissionerActivity)) {
      for (const topic of activity.topics) {
        if (!topic.categories.includes(id)) continue;
        commissionerCounts[commId] = (commissionerCounts[commId] || 0) + 1;
        timeline.push({ commissionerId: commId, date: meeting.date, text: topic.text, meetingId: meeting.id });
        for (const cat of topic.categories) {
          if (cat !== id) coCategories[cat] = (coCategories[cat] || 0) + 1;
        }
      }
    }
  }

  const totalActions = timeline.length;
  const sortedCommissioners = Object.entries(commissionerCounts).sort((a, b) => b[1] - a[1]);
  const maxCommCount = sortedCommissioners[0]?.[1] || 1;
  const sortedCoCategories = Object.entries(coCategories).sort((a, b) => b[1] - a[1]);

  const relatedStatements: { commissionerId: string; statement: typeof PUBLIC_STATEMENTS[string][number] }[] = [];
  for (const [commId, statements] of Object.entries(PUBLIC_STATEMENTS)) {
    for (const stmt of statements) {
      if (stmt.categories.includes(id)) {
        relatedStatements.push({ commissionerId: commId, statement: stmt });
      }
    }
  }
  relatedStatements.sort((a, b) => b.statement.date.localeCompare(a.statement.date));

  const otherTopics = CATEGORIES.filter((c) => c.id !== id);

  function getTopicCommissioners(catId: string) {
    const comms = new Set<string>();
    for (const meeting of meetings) {
      for (const [commId, activity] of Object.entries(meeting.commissionerActivity)) {
        for (const topic of activity.topics) {
          if (topic.categories.includes(catId)) comms.add(commId);
        }
      }
    }
    return comms;
  }

  function getTopicActionCount(catId: string) {
    let count = 0;
    for (const meeting of meetings) {
      for (const activity of Object.values(meeting.commissionerActivity)) {
        for (const topic of activity.topics) {
          if (topic.categories.includes(catId)) count++;
        }
      }
    }
    return count;
  }

  return (
    <div className="px-4 md:px-8 py-8 md:py-12 max-w-7xl mx-auto">
      <header className="mb-10 md:mb-16 border-b border-outline-variant/20 pb-8 md:pb-12 flex flex-col md:flex-row justify-between items-end gap-6 md:gap-8">
        <div className="max-w-2xl">
          <span className="font-label text-xs uppercase tracking-[0.2em] text-secondary mb-4 block">Central Repository</span>
          <h1 className="font-headline text-3xl md:text-5xl lg:text-6xl font-black text-primary leading-tight">
            {category.label}
          </h1>
          <p className="font-body text-lg text-on-surface-variant mt-6 leading-relaxed">
            Tracking commissioner engagement, legislative actions, and public statements related to {category.label.toLowerCase()} across all recorded meetings.
          </p>
        </div>
      </header>

      <div className="mb-12">
        <FilterBar dateOnly />
      </div>

      <section className="mb-12 md:mb-24">
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8 md:gap-12">
          <div className="lg:col-span-4 flex flex-col gap-6 md:gap-8">
            <div className="bg-surface-container-low p-8 rounded-xl shadow-[0_10px_40px_rgba(25,28,28,0.06)]">
              <span className="inline-block bg-secondary-fixed text-on-secondary-fixed font-label text-[10px] uppercase tracking-widest px-3 py-1 rounded-full mb-6">Topic Primary</span>
              <div className="flex items-center gap-3 mb-4">
                {materialIcon && <span className="material-symbols-outlined text-secondary text-3xl">{materialIcon}</span>}
                <h2 className="font-headline text-3xl font-bold text-primary">{category.label}</h2>
              </div>
              <div className="space-y-6 mt-8">
                <div>
                  <span className="font-label text-xs text-outline uppercase tracking-wider block mb-2">Total Ledger Entries</span>
                  <span className="font-headline text-4xl font-black text-primary">{totalActions}</span>
                </div>
                <div>
                  <span className="font-label text-xs text-outline uppercase tracking-wider block mb-2">Active Commissioners</span>
                  <span className="font-headline text-4xl font-black text-primary">{sortedCommissioners.length}</span>
                </div>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-8 rounded-xl shadow-[0_10px_40px_rgba(25,28,28,0.06)]">
              <h3 className="font-headline text-xl font-bold text-primary mb-6">Who&apos;s Most Active on This</h3>
              <div className="space-y-5">
                {sortedCommissioners.map(([commId, count], i) => {
                  const commissioner = COMMISSIONERS.find((c) => c.id === commId);
                  if (!commissioner) return null;
                  const pct = Math.round((count / maxCommCount) * 100);
                  return (
                    <Link key={commId} href={`/commissioners/${commId}`} className="block space-y-2 group">
                      <div className="flex justify-between font-label text-sm">
                        <span className="text-primary font-bold group-hover:underline">{commissioner.name}</span>
                        <span className="text-outline">{count} {count === 1 ? "action" : "actions"}</span>
                      </div>
                      <div className="w-full h-3 bg-surface-container rounded-full overflow-hidden">
                        <div className={`h-full ${BAR_COLORS[i % BAR_COLORS.length]} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {relatedStatements.length > 0 && (
              <div className="bg-surface-container-lowest p-8 rounded-xl shadow-[0_10px_40px_rgba(25,28,28,0.06)]">
                <h3 className="font-headline text-xl font-bold text-primary mb-6">Related Statements &amp; News</h3>
                <ul className="space-y-8">
                  {relatedStatements.map((item, i) => {
                    const commissioner = COMMISSIONERS.find((c) => c.id === item.commissionerId);
                    return (
                      <li key={i} className="flex gap-4">
                        <span className="material-symbols-outlined text-secondary shrink-0">{item.statement.type === "news" ? "newspaper" : "mic"}</span>
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Link href={`/commissioners/${item.commissionerId}`} className="text-sm font-bold hover:underline">{commissioner?.name}</Link>
                            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">
                              {new Date(item.statement.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          </div>
                          <p className="text-sm text-on-surface-variant leading-relaxed">{item.statement.text}</p>
                          {item.statement.url && (
                            <a href={item.statement.url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-primary uppercase tracking-wider mt-2 inline-flex items-center gap-1 hover:underline">
                              Read article <span className="material-symbols-outlined text-xs">arrow_forward</span>
                            </a>
                          )}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {item.statement.categories.map((catId) => <CategoryTag key={catId} id={catId} />)}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          <div className="lg:col-span-8">
            <div className="bg-white p-10 rounded-xl shadow-[0_10px_40px_rgba(25,28,28,0.06)]">
              <div className="flex items-center justify-between mb-10 pb-6 border-b border-outline-variant/10">
                <h3 className="font-headline text-2xl font-bold text-primary">Activity Timeline</h3>
                <span className="font-label text-xs text-outline uppercase">{totalActions} entries</span>
              </div>
              <div className="space-y-0">
                {timeline.length === 0 && (
                  <p className="text-on-surface-variant text-sm italic py-8 text-center">No activity in the selected time period.</p>
                )}
                {timeline
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((item, i) => {
                    const commissioner = COMMISSIONERS.find((c) => c.id === item.commissionerId);
                    const isLast = i === timeline.length - 1;
                    return (
                      <div key={i} className={`relative pl-12 ${isLast ? "" : "pb-12"}`}>
                        {!isLast && <div className="absolute left-[7px] top-0 bottom-0 w-px bg-outline-variant/20" />}
                        <div className={`absolute left-0 top-1.5 w-[15px] h-[15px] ${DOT_COLORS[i % DOT_COLORS.length]} rounded-full z-10 border-4 border-white`} />
                        <div className="flex flex-col md:flex-row md:items-start gap-4">
                          <div className="min-w-[120px]">
                            <Link href={`/commissioners/${item.commissionerId}`} className="font-label text-sm font-bold text-primary block hover:underline">{commissioner?.name}</Link>
                            <Link href={`/meetings/${item.meetingId}`} className="font-label text-xs text-outline hover:text-primary transition-colors">
                              {new Date(item.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </Link>
                          </div>
                          <div>
                            <p className="font-body text-on-surface-variant text-sm leading-relaxed mb-3">{item.text}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-4 mb-10">
          <h2 className="font-headline text-3xl font-bold text-primary">Other Policy Areas</h2>
          <div className="h-px bg-outline-variant/30 flex-grow" />
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {otherTopics.slice(0, 6).map((topic) => {
            const icon = CATEGORY_ICONS[topic.id];
            const actionCount = getTopicActionCount(topic.id);
            const activeComms = getTopicCommissioners(topic.id);
            const commArray = Array.from(activeComms).map((cid) => COMMISSIONERS.find((c) => c.id === cid)).filter(Boolean);
            return (
              <Link key={topic.id} href={`/topics/${topic.id}`} className="bg-white p-8 rounded-xl border border-outline-variant/10 hover:border-primary transition-all group">
                <div className="flex justify-between items-start mb-6">
                  {icon && <span className="material-symbols-outlined text-secondary text-3xl">{icon}</span>}
                  <span className="font-label text-xs text-outline">{actionCount} Active</span>
                </div>
                <h3 className="font-headline text-2xl font-bold text-primary mb-3">{topic.label}</h3>
                <div className="flex items-center gap-4 pt-6 border-t border-outline-variant/10">
                  <div className="flex -space-x-2">
                    {commArray.slice(0, 3).map((comm) => (
                      <div key={comm!.id} className="w-6 h-6 rounded-full ring-2 ring-white" style={{ backgroundColor: comm!.color }} />
                    ))}
                  </div>
                  <span className="font-label text-[10px] text-outline uppercase">{activeComms.size} Active Commissioner{activeComms.size !== 1 ? "s" : ""}</span>
                </div>
              </Link>
            );
          })}
        </div>

        {sortedCoCategories.length > 0 && (
          <div className="mt-12">
            <h3 className="font-headline text-xl font-bold text-primary mb-4 flex items-center gap-3">
              <span className="w-6 h-px bg-primary" /> Related Topics
            </h3>
            <div className="flex flex-wrap gap-2">
              {sortedCoCategories.map(([catId, count]) => {
                const cat = CATEGORIES.find((c) => c.id === catId);
                const icon = CATEGORY_ICONS[catId];
                if (!cat) return null;
                return (
                  <Link key={catId} href={`/topics/${catId}`} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 bg-secondary-fixed text-on-secondary-fixed text-xs font-bold uppercase hover:opacity-80 transition-opacity">
                    {icon && <span className="material-symbols-outlined text-[14px]">{icon}</span>}
                    {cat.label}
                    <span className="text-[10px] opacity-60">({count})</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default function TopicDetail() {
  return (
    <Suspense>
      <TopicContent />
    </Suspense>
  );
}
