"use client";

import { Suspense, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { COMMISSIONERS, CATEGORIES, CATEGORY_ICONS } from "@/lib/constants";
import { useMeetings } from "@/lib/meetings-context";
import { type FollowUpItem, getSourceUrl } from "@/lib/types";

const STATUS_CONFIG: Record<FollowUpItem["status"], { label: string; bg: string; text: string; icon: string }> = {
  open: { label: "Open", bg: "bg-error/10", text: "text-error", icon: "radio_button_unchecked" },
  in_progress: { label: "In Progress", bg: "bg-tertiary-fixed", text: "text-on-tertiary-fixed-variant", icon: "pending" },
  resolved: { label: "Resolved", bg: "bg-secondary-fixed", text: "text-on-secondary-fixed", icon: "check_circle" },
  dropped: { label: "Dropped", bg: "bg-surface-container-high", text: "text-on-surface-variant", icon: "cancel" },
};

function getOwnerDisplayName(owner: string) {
  const commissioner = COMMISSIONERS.find((c) => c.id === owner);
  if (commissioner) return commissioner.name;
  if (owner === "staff") return "County Staff";
  return owner; // Already a full name like "Jaime Laughter"
}

function getOwnerLink(owner: string): string | null {
  const commissioner = COMMISSIONERS.find((c) => c.id === owner);
  if (commissioner) return `/commissioners/${commissioner.id}`;
  return null;
}

function daysSince(dateStr: string) {
  const raised = new Date(dateStr + "T12:00:00");
  const now = new Date();
  return Math.floor((now.getTime() - raised.getTime()) / (1000 * 60 * 60 * 24));
}

function getDaysColor(days: number, isResolved: boolean) {
  if (isResolved) return "text-secondary";
  if (days > 120) return "text-error";
  if (days >= 60) return "text-amber-600";
  return "text-on-surface-variant";
}

// Simple admin check — for now, check a localStorage flag.
// Replace with real auth session check when auth is added.
function useIsAdmin() {
  const [isAdmin] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("tc-admin") === "true";
  });
  return isAdmin;
}

function FollowUpsContent() {
  const { meetings } = useMeetings();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = useIsAdmin();

  function getMeetingSourceUrl(meetingId: string): string {
    const m = meetings.find((mtg) => mtg.id === meetingId);
    if (m?.sourceUrl) return m.sourceUrl;
    if (m) return getSourceUrl(m.date, m.type);
    return getSourceUrl(meetingId, "regular");
  }

  // Gather all follow-ups and build a "last referenced" lookup
  const { allFollowUps, lastReferenced } = useMemo(() => {
    const items: FollowUpItem[] = [];
    const refMap: Record<string, { meetingId: string; date: string }> = {};

    // Sort meetings by date to track references chronologically
    const sortedMeetings = [...meetings].sort((a, b) => a.date.localeCompare(b.date));

    for (const m of sortedMeetings) {
      if (m.followUps) {
        for (const raw of m.followUps) {
          // Normalize legacy "raisedBy" field to "owner"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fu = { ...raw, owner: raw.owner || (raw as any).raisedBy || "staff" } as FollowUpItem;
          // If this follow-up's relatedMeetingId matches the current meeting,
          // it was raised here — collect it
          if (fu.relatedMeetingId === m.id) {
            items.push(fu);
          }
          // If lastReferencedMeetingId is set in the data, use it
          if (fu.lastReferencedMeetingId) {
            refMap[fu.id] = { meetingId: fu.lastReferencedMeetingId, date: m.date };
          }
        }
      }
    }

    // Deduplicate by ID (in case same follow-up appears in multiple meeting files)
    const deduped = new Map<string, FollowUpItem>();
    for (const item of items) {
      deduped.set(item.id, item);
    }

    return {
      allFollowUps: Array.from(deduped.values()).sort((a, b) => b.dateRaised.localeCompare(a.dateRaised)),
      lastReferenced: refMap,
    };
  }, [meetings]);

  // Filters from URL
  const ownerFilter = searchParams.get("owner") || "";
  const catFilter = searchParams.get("cat") || "";

  const filtered = useMemo(() => {
    let items = allFollowUps;
    if (ownerFilter) {
      items = items.filter((f) => f.owner === ownerFilter);
    }
    if (catFilter) {
      items = items.filter((f) => f.categories.includes(catFilter));
    }
    return items;
  }, [allFollowUps, ownerFilter, catFilter]);

  // Status overrides from localStorage
  const [statusOverrides, setStatusOverrides] = useState<Record<string, FollowUpItem["status"]>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("tc-followup-status") || "{}");
    } catch {
      return {};
    }
  });

  function getEffectiveStatus(item: FollowUpItem): FollowUpItem["status"] {
    return statusOverrides[item.id] || item.status;
  }

  const openItems = filtered.filter((f) => {
    const s = getEffectiveStatus(f);
    return s === "open" || s === "in_progress";
  });
  const resolvedItems = filtered.filter((f) => {
    const s = getEffectiveStatus(f);
    return s === "resolved" || s === "dropped";
  });

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function updateStatus(itemId: string, newStatus: FollowUpItem["status"]) {
    const next = { ...statusOverrides, [itemId]: newStatus };
    setStatusOverrides(next);
    try {
      localStorage.setItem("tc-followup-status", JSON.stringify(next));
    } catch { /* ignore */ }
  }

  // Build unique owners for filter dropdown
  const uniqueOwners = useMemo(() => {
    const owners = new Set<string>();
    for (const f of allFollowUps) {
      if (f.owner) owners.add(f.owner);
    }
    return Array.from(owners).sort();
  }, [allFollowUps]);

  return (
    <div className="px-4 md:px-8 lg:px-12 py-8 md:py-16 max-w-screen-2xl mx-auto">
      {/* Header */}
      <header className="mb-10 md:mb-16">
        <span className="text-secondary font-label font-bold tracking-widest text-xs uppercase mb-4 block">Accountability Tracker</span>
        <h1 className="font-headline text-3xl md:text-5xl lg:text-6xl font-extrabold text-primary tracking-tight leading-none mb-4 md:mb-6">
          Follow-Through Ledger
        </h1>
        <p className="text-on-surface-variant text-lg leading-relaxed font-body max-w-2xl">
          Tracking commitments made during meetings — items where commissioners or staff said something would be done. Open items are monitored until resolved.
        </p>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-12">
        <select
          value={ownerFilter}
          onChange={(e) => setFilter("owner", e.target.value)}
          className="bg-surface-container-low border border-outline-variant/30 rounded-lg px-3 py-2 text-xs font-label font-bold uppercase tracking-tight focus:ring-1 focus:ring-primary focus:border-primary outline-none"
        >
          <option value="">All Owners</option>
          {uniqueOwners.map((owner) => (
            <option key={owner} value={owner}>{getOwnerDisplayName(owner)}</option>
          ))}
        </select>

        <select
          value={catFilter}
          onChange={(e) => setFilter("cat", e.target.value)}
          className="bg-surface-container-low border border-outline-variant/30 rounded-lg px-3 py-2 text-xs font-label font-bold uppercase tracking-tight focus:ring-1 focus:ring-primary focus:border-primary outline-none"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>

        {(ownerFilter || catFilter) && (
          <button
            onClick={() => router.push(pathname, { scroll: false })}
            className="flex items-center gap-1 px-3 py-2 text-[11px] font-bold uppercase tracking-tight text-error hover:bg-error/5 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
            Clear
          </button>
        )}

        <span className="text-xs font-label font-bold text-on-surface-variant uppercase tracking-wider ml-auto">
          {openItems.length} open · {resolvedItems.length} resolved
        </span>
      </div>

      {/* Open Items */}
      <section className="mb-20">
        <h2 className="font-headline text-3xl font-bold text-primary mb-8 flex items-center gap-3">
          <span className="material-symbols-outlined text-error">pending_actions</span>
          Open Items
        </h2>

        {openItems.length === 0 ? (
          <p className="text-on-surface-variant text-sm italic py-8 text-center">No open follow-up items match the current filters.</p>
        ) : (
          <div className="space-y-4">
            {openItems.map((item) => {
              const effectiveStatus = getEffectiveStatus(item);
              const config = STATUS_CONFIG[effectiveStatus];
              const days = daysSince(item.dateRaised);
              const daysColor = getDaysColor(days, false);
              const ownerLink = getOwnerLink(item.owner);
              const ref = lastReferenced[item.id];

              return (
                <div key={item.id} className="bg-surface-container-lowest border border-outline-variant/20 p-4 md:p-6 rounded-lg flex flex-col md:flex-row md:items-start gap-4 md:gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 md:gap-3 mb-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${config.bg} ${config.text}`}>
                        <span className="material-symbols-outlined text-[14px]">{config.icon}</span>
                        {config.label}
                      </span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${daysColor}`}>
                        {days} days open
                      </span>
                    </div>
                    <p className="text-sm text-on-surface leading-relaxed font-medium">{item.description}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-on-surface-variant flex-wrap">
                      {ownerLink ? (
                        <Link href={ownerLink} className="font-bold hover:underline">
                          {getOwnerDisplayName(item.owner)}
                        </Link>
                      ) : (
                        <span className="font-bold">{getOwnerDisplayName(item.owner)}</span>
                      )}
                      <span>·</span>
                      <span className="inline-flex items-center gap-1.5">
                        <Link href={`/meetings/${item.relatedMeetingId}`} className="hover:underline">
                          {new Date(item.dateRaised + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </Link>
                        <a href={getMeetingSourceUrl(item.relatedMeetingId)} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors" title="View official minutes (PDF)">
                          <span className="material-symbols-outlined text-[14px]">description</span>
                        </a>
                      </span>
                      {ref && ref.meetingId !== item.relatedMeetingId && (
                        <>
                          <span>·</span>
                          <span className="text-secondary">
                            Last referenced:{" "}
                            <Link href={`/meetings/${ref.meetingId}`} className="hover:underline font-bold">
                              {new Date(ref.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </Link>
                          </span>
                        </>
                      )}
                      <div className="flex gap-1 ml-auto">
                        {item.categories.map((catId) => {
                          const cat = CATEGORIES.find((c) => c.id === catId);
                          const icon = CATEGORY_ICONS[catId];
                          if (!cat) return null;
                          return (
                            <Link
                              key={catId}
                              href={`/topics/${catId}`}
                              className="inline-flex items-center gap-1 bg-secondary-fixed text-on-secondary-fixed px-2 py-0.5 rounded-full text-[9px] font-bold uppercase hover:opacity-80"
                            >
                              {icon && <span className="material-symbols-outlined text-[12px]">{icon}</span>}
                              {cat.label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  {/* Status update — admin only */}
                  {isAdmin ? (
                    <select
                      value={effectiveStatus}
                      onChange={(e) => updateStatus(item.id, e.target.value as FollowUpItem["status"])}
                      className="bg-surface-container-low border border-outline-variant/30 rounded px-2 py-1.5 text-[10px] font-label font-bold uppercase tracking-tight focus:ring-1 focus:ring-primary outline-none shrink-0"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="dropped">Dropped</option>
                    </select>
                  ) : (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-bold uppercase tracking-tight ${config.bg} ${config.text} shrink-0`}>
                      <span className="material-symbols-outlined text-[14px]">{config.icon}</span>
                      {config.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Resolved Items */}
      {resolvedItems.length > 0 && (
        <section>
          <h2 className="font-headline text-3xl font-bold text-primary mb-8 flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary">task_alt</span>
            Resolved &amp; Closed
          </h2>
          <div className="space-y-3">
            {resolvedItems.map((item) => {
              const effectiveStatus = getEffectiveStatus(item);
              const config = STATUS_CONFIG[effectiveStatus];
              const days = daysSince(item.dateRaised);
              const ownerLink = getOwnerLink(item.owner);
              const ref = lastReferenced[item.id];

              return (
                <div key={item.id} className="bg-surface-container-low border border-outline-variant/10 p-5 rounded-lg flex flex-col md:flex-row md:items-center gap-4 opacity-70">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${config.bg} ${config.text}`}>
                        <span className="material-symbols-outlined text-[12px]">{config.icon}</span>
                        {config.label}
                      </span>
                      <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">
                        {days} days
                      </span>
                    </div>
                    <p className="text-sm text-on-surface-variant">{item.description}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-on-surface-variant flex-wrap">
                      {ownerLink ? (
                        <Link href={ownerLink} className="font-bold hover:underline">
                          {getOwnerDisplayName(item.owner)}
                        </Link>
                      ) : (
                        <span className="font-bold">{getOwnerDisplayName(item.owner)}</span>
                      )}
                      <span>·</span>
                      <span className="inline-flex items-center gap-1.5">
                        <Link href={`/meetings/${item.relatedMeetingId}`} className="hover:underline">
                          {new Date(item.dateRaised + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </Link>
                        <a href={getMeetingSourceUrl(item.relatedMeetingId)} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors" title="View official minutes (PDF)">
                          <span className="material-symbols-outlined text-[14px]">description</span>
                        </a>
                      </span>
                      {ref && ref.meetingId !== item.relatedMeetingId && (
                        <>
                          <span>·</span>
                          <Link href={`/meetings/${ref.meetingId}`} className="hover:underline text-secondary">
                            Resolved {new Date(ref.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </Link>
                        </>
                      )}
                      {item.resolution && (
                        <>
                          <span>·</span>
                          <span className="italic">{item.resolution}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {isAdmin ? (
                    <select
                      value={effectiveStatus}
                      onChange={(e) => updateStatus(item.id, e.target.value as FollowUpItem["status"])}
                      className="bg-surface-container border border-outline-variant/30 rounded px-2 py-1.5 text-[10px] font-label font-bold uppercase tracking-tight focus:ring-1 focus:ring-primary outline-none shrink-0"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="dropped">Dropped</option>
                    </select>
                  ) : (
                    <span className={`inline-flex items-center gap-1 px-2 py-1.5 rounded text-[10px] font-bold uppercase ${config.bg} ${config.text} shrink-0`}>
                      <span className="material-symbols-outlined text-[12px]">{config.icon}</span>
                      {config.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

export default function FollowUpsPage() {
  return (
    <Suspense>
      <FollowUpsContent />
    </Suspense>
  );
}
