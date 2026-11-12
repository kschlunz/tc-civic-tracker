"use client";

import Link from "next/link";
import type { KeyVote } from "@/lib/types";
import { COMMISSIONERS } from "@/lib/constants";

function getCommissionerName(id: string) {
  return COMMISSIONERS.find((c) => c.id === id)?.name ?? id;
}

interface VoteDetailModalProps {
  vote: KeyVote;
  onClose: () => void;
}

export default function VoteDetailModal({ vote, onClose }: VoteDetailModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-primary/20 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-surface-bright shadow-2xl rounded-xl overflow-hidden border border-outline-variant/30 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-8 py-6 border-b border-outline-variant/10">
          <div className="flex-1">
            <div className="mb-3">
              {!vote.passed ? (
                <span className="bg-error/10 text-error px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                  Failed {vote.result !== "Failed" && `· ${vote.result}`}
                </span>
              ) : vote.result === "Unanimous" ? (
                <span className="bg-secondary-fixed text-on-secondary-fixed px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                  Unanimous
                </span>
              ) : (
                <span className="bg-surface-container-high text-on-surface-variant px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                  {vote.result}
                </span>
              )}
            </div>
            <h2 className="font-headline text-2xl font-bold text-primary tracking-tight">
              {vote.description}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant shrink-0 ml-4"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-8 overflow-y-auto flex-1 space-y-8">
          {/* Mover / Seconder */}
          {vote.consent && (
            <p className="text-sm text-on-surface-variant font-bold uppercase tracking-wider">Consent Agenda Item</p>
          )}
          {(vote.mover || vote.seconder) && (
            <div className="flex gap-8">
              {vote.mover && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Moved by</span>
                  <Link href={`/commissioners/${vote.mover}`} className="font-headline text-lg font-bold text-primary hover:underline">
                    {getCommissionerName(vote.mover)}
                  </Link>
                </div>
              )}
              {vote.seconder && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Seconded by</span>
                  <Link href={`/commissioners/${vote.seconder}`} className="font-headline text-lg font-bold text-primary hover:underline">
                    {getCommissionerName(vote.seconder)}
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Roll call */}
          {vote.votes && (
            <div>
              <h3 className="font-headline text-xl font-bold text-primary mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">how_to_vote</span>
                How they voted
              </h3>
              <dl className="space-y-2 text-sm">
                {(
                  [
                    ["For", vote.votes.ayes],
                    ["Against", vote.votes.nays],
                    ["Abstained", vote.votes.abstained],
                    ["Absent", vote.votes.absent],
                  ] as const
                )
                  .filter(([, ids]) => ids.length > 0)
                  .map(([label, ids]) => (
                    <div key={label} className="flex gap-4">
                      <dt className="w-24 shrink-0 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant pt-0.5">{label}</dt>
                      <dd className={label === "Against" ? "font-bold text-error" : "text-on-surface"}>
                        {ids.map((id, i) => (
                          <span key={id}>
                            {i > 0 && ", "}
                            <Link href={`/commissioners/${id}`} className="hover:underline">{getCommissionerName(id)}</Link>
                          </span>
                        ))}
                      </dd>
                    </div>
                  ))}
              </dl>
            </div>
          )}

          {/* Background */}
          {vote.background && (
            <div>
              <h3 className="font-headline text-xl font-bold text-primary mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">info</span>
                Background
              </h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                {vote.background}
              </p>
            </div>
          )}

          {/* Discussion */}
          {vote.discussion && (
            <div>
              <h3 className="font-headline text-xl font-bold text-primary mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">forum</span>
                Discussion
              </h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                {vote.discussion}
              </p>
            </div>
          )}

          {/* No detail available */}
          {!vote.background && !vote.discussion && !vote.votes && (
            <p className="text-sm text-on-surface-variant italic">
              No additional detail available for this vote.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
