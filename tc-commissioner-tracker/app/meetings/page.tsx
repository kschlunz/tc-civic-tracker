"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useMeetings } from "@/lib/meetings-context";
import { parseFiltersFromParams, filterMeetings } from "@/lib/filters";
import MeetingIntakeForm from "@/components/MeetingIntakeForm";
import FilterBar from "@/components/FilterBar";
import type { Meeting, FollowUpItem } from "@/lib/types";

interface ResolvedFollowUp {
  id: string;
  status: "in_progress" | "resolved";
  resolution: string;
}

const PAGE_SIZE = 10;

function MeetingsContent() {
  const { meetings: allMeetings, draftIds, addMeeting } = useMeetings();
  const [showIntake, setShowIntake] = useState(false);
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

  function handleAccept(meeting: Meeting, acceptedResolutions: ResolvedFollowUp[]) {
    addMeeting(meeting);

    // Apply accepted follow-up resolutions to localStorage
    if (acceptedResolutions.length > 0) {
      try {
        const existing = JSON.parse(localStorage.getItem("tc-followup-status") || "{}");
        for (const r of acceptedResolutions) {
          existing[r.id] = r.status;
        }
        localStorage.setItem("tc-followup-status", JSON.stringify(existing));
      } catch { /* ignore */ }
    }

    setShowIntake(false);
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
            A permanent archive of civic discourse. Track legislative progression, review committee summaries, and analyze the evolution of local policy through curated meeting transcripts.
          </p>
        </div>
        <div className="flex flex-col items-start md:items-end gap-2">
          <div className="text-right">
            <p className="text-on-surface-variant font-label text-xs uppercase tracking-wider">Archive Status</p>
            <p className="text-primary font-headline italic text-xl">Active &amp; Synchronized</p>
          </div>
        </div>
      </header>

      {/* Add Meeting Notes Section */}
      <section className="mb-12 md:mb-24">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-0">
          <div className="md:col-span-8 bg-surface-container-low p-6 md:p-12 rounded-t-xl md:rounded-l-xl md:rounded-tr-none flex flex-col justify-center">
            <h2 className="font-headline text-3xl text-primary mb-4">Analyze New Deliberations</h2>
            <p className="text-on-surface-variant font-body mb-8 max-w-lg">
              Paste meeting transcripts or AI-generated summaries here. Our system will parse key decisions, voting records, and thematic shifts to update the ledger.
            </p>
            <button
              onClick={() => setShowIntake(true)}
              className="bg-primary text-on-primary px-8 py-3 rounded shadow-lg hover:bg-primary-container transition-colors flex items-center gap-2 w-fit"
            >
              <span className="material-symbols-outlined text-sm">analytics</span>
              <span className="font-label text-sm font-bold">Process Meeting Notes</span>
            </button>
          </div>
          <div className="md:col-span-4 bg-primary-container p-6 md:p-12 flex flex-col justify-between text-on-primary rounded-b-xl md:rounded-r-xl md:rounded-bl-none">
            <div>
              <span className="material-symbols-outlined text-4xl mb-6 opacity-40">data_object</span>
              <h3 className="font-headline text-2xl mb-4 text-primary-fixed">AI-Powered Extraction</h3>
              <p className="text-on-primary-container text-sm leading-relaxed mb-6">
                Paste raw meeting minutes and our AI will extract structured data — votes, commissioner activity, topics, and public comments.
              </p>
            </div>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-xs font-label text-on-primary-container">
                <span className="material-symbols-outlined text-sm text-primary-fixed">check_circle</span>
                Identify Voting Records
              </li>
              <li className="flex items-center gap-3 text-xs font-label text-on-primary-container">
                <span className="material-symbols-outlined text-sm text-primary-fixed">check_circle</span>
                Extract Commissioner Activity
              </li>
              <li className="flex items-center gap-3 text-xs font-label text-on-primary-container">
                <span className="material-symbols-outlined text-sm text-primary-fixed">check_circle</span>
                Cross-reference Topics
              </li>
            </ul>
          </div>
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
                    {meeting.duration}
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
                    {draftIds.has(meeting.id) && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-tertiary-fixed text-on-tertiary-fixed-variant rounded-full text-[10px] font-bold uppercase tracking-tighter">
                        <span className="material-symbols-outlined text-[12px]">edit_note</span>
                        Draft — not yet committed
                      </span>
                    )}
                  </div>
                </div>
                <div className="md:col-span-5">
                  <p className="text-on-surface-variant font-body text-sm leading-relaxed line-clamp-3">
                    {meeting.tldr}
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                    <span>{meeting.attendees.length} commissioners</span>
                    <span>~{meeting.audienceSize} audience</span>
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

      {/* Intake Modal */}
      {showIntake && (
        <MeetingIntakeForm
          onAccept={handleAccept}
          onClose={() => setShowIntake(false)}
        />
      )}
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
