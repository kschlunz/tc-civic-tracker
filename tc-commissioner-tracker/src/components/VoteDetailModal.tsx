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
              {vote.result.toLowerCase() === "unanimous" ? (
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
          {vote.mover !== "consent agenda" ? (
            <div className="flex gap-8">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Moved by</span>
                <Link href={`/commissioners/${vote.mover}`} className="font-headline text-lg font-bold text-primary hover:underline">
                  {getCommissionerName(vote.mover)}
                </Link>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Seconded by</span>
                <Link href={`/commissioners/${vote.seconder}`} className="font-headline text-lg font-bold text-primary hover:underline">
                  {getCommissionerName(vote.seconder)}
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant font-bold uppercase tracking-wider">Consent Agenda Item</p>
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
          {!vote.background && !vote.discussion && (
            <p className="text-sm text-on-surface-variant italic">
              No additional detail available for this vote.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
