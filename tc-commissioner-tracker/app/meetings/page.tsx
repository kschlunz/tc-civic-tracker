"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useMeetings } from "@/lib/meetings-context";
import { parseFiltersFromParams, filterMeetings } from "@/lib/filters";
import FilterBar from "@/components/FilterBar";

const PAGE_SIZE = 10;

function MeetingsContent() {
  const { meetings: allMeetings } = useMeetings();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = parseFiltersFromParams(searchParams);
  const filtered = filterMeetings(allMeetings, filters);
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (p <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(p));
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="px-4 md:px-8 lg:px-12 py-8 md:py-16 max-w-screen-2xl mx-auto">
      {/* Hero Section */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 md:gap-8 mb-12 md:mb-20">
        <div className="max-w-2xl">
          <span className="text-secondary font-label font-bold tracking-widest text-xs uppercase mb-4 block">Official Record</span>
          <h1 className="font-headline text-3xl md:text-5xl lg:text-6xl font-extrabold text-primary tracking-tight leading-none mb-4 md:mb-6">
            Meetings &amp; Deliberations
          </h1>
          <p className="text-on-surface-variant text-lg leading-relaxed font-body">
            A permanent archive of civic discourse. Every record is drawn from the county&apos;s official minutes, with votes, commissioner activity and public comment set out meeting by meeting.
          </p>
        </div>
        <div className="flex flex-col items-start md:items-end gap-2">
          <div className="text-right">
            <p className="text-on-surface-variant font-label text-xs uppercase tracking-wider">Archive Status</p>
            <p className="text-primary font-headline italic text-xl">{allMeetings.length} meetings on record</p>
          </div>
        </div>
      </header>

      {/* How the record is kept */}
      <section className="mb-12 md:mb-24">
        <div className="bg-surface-container-low p-6 md:p-12 rounded-xl">
          <h2 className="font-headline text-3xl text-primary mb-4">How this record is kept</h2>
          <p className="text-on-surface-variant font-body max-w-3xl leading-relaxed">
            When the county posts approved minutes, they are read automatically, checked a second time against the original PDF, and reviewed by a volunteer before they appear here. Every meeting links to the official minutes, agenda and video so you can check the record yourself.
          </p>
        </div>
      </section>

      {/* Meeting Ledger */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-headline text-4xl text-primary">Meeting Ledger</h2>
        </div>

        <div className="mb-8">
          <FilterBar />
        </div>

        {/* Results count */}
        <p className="text-xs font-label font-bold text-on-surface-variant uppercase tracking-wider mb-6">
          {sorted.length} {sorted.length === 1 ? "meeting" : "meetings"} found
          {totalPages > 1 && ` · Page ${page} of ${totalPages}`}
        </p>

        <div className="space-y-0">
          {paginated.map((meeting, i) => (
            <div key={meeting.id}>
              {i > 0 && <div className="h-px bg-outline-variant/10" />}
              <Link
                href={`/meetings/${meeting.id}`}
                className="group relative flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-8 items-start hover:bg-surface-container-low/30 p-4 md:p-8 -mx-4 md:-mx-8 transition-all rounded-xl min-h-[44px]"
              >
                <div className="md:col-span-2">
                  <span className="text-xs font-label font-bold text-secondary uppercase tracking-widest block mb-1">
                    {new Date(meeting.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </span>
                  <div className="flex items-center gap-2 text-on-surface-variant text-xs">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    {meeting.duration ?? meeting.time}
                  </div>
                </div>
                <div className="md:col-span-3">
                  <h3 className="font-headline text-2xl text-primary mb-2">
                    Board of Commissioners
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center px-3 py-1 bg-secondary-fixed text-on-secondary-fixed rounded-full text-[10px] font-bold uppercase tracking-tighter capitalize">
                      {meeting.type}
                    </span>
                  </div>
                </div>
                <div className="md:col-span-5">
                  <p className="text-on-surface-variant font-body text-sm leading-relaxed line-clamp-3">
                    {meeting.tldr}
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                    <span>{meeting.attendees.length} commissioners</span>
                    {meeting.audienceSize !== null && <span>~{meeting.audienceSize} audience</span>}
                    <span>{meeting.keyVotes.length} votes</span>
                  </div>
                </div>
                <div className="hidden md:flex md:col-span-2 justify-end">
                  <span className="p-3 rounded-full group-hover:bg-surface-container-high transition-colors text-primary inline-flex">
                    <span className="material-symbols-outlined">chevron_right</span>
                  </span>
                </div>
              </Link>
            </div>
          ))}
        </div>

        {sorted.length === 0 && (
          <p className="text-on-surface-variant text-sm italic py-12 text-center">No meetings match the current filters.</p>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-12">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-label font-bold text-primary hover:bg-surface-container-high rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-lg">chevron_left</span>
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => goToPage(p)}
                  className={`w-8 h-8 rounded text-xs font-bold transition-colors ${
                    p === page
                      ? "bg-primary text-on-primary"
                      : "text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-label font-bold text-primary hover:bg-surface-container-high rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next
              <span className="material-symbols-outlined text-lg">chevron_right</span>
            </button>
          </div>
        )}
      </section>

    </div>
  );
}

export default function MeetingsList() {
  return (
    <Suspense>
      <MeetingsContent />
    </Suspense>
  );
}
