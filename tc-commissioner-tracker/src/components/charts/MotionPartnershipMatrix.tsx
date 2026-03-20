"use client";

import { COMMISSIONERS } from "@/lib/constants";
import type { Meeting } from "@/lib/types";

interface MotionPartnershipMatrixProps {
  meetings: Meeting[];
}

export default function MotionPartnershipMatrix({ meetings }: MotionPartnershipMatrixProps) {
  if (meetings.length < 5) {
    return (
      <div className="bg-surface-container-low p-8 rounded-lg text-center">
        <span className="material-symbols-outlined text-4xl text-outline-variant mb-3 block">grid_view</span>
        <p className="text-sm text-on-surface-variant font-bold">More data needed</p>
        <p className="text-xs text-on-surface-variant mt-1">Motion partnership data requires at least 5 meetings.</p>
      </div>
    );
  }

  // Build the matrix: matrix[mover][seconder] = count
  const matrix: Record<string, Record<string, number>> = {};
  for (const c of COMMISSIONERS) {
    matrix[c.id] = {};
    for (const c2 of COMMISSIONERS) {
      matrix[c.id][c2.id] = 0;
    }
  }

  for (const meeting of meetings) {
    for (const vote of meeting.keyVotes) {
      if (vote.mover === "consent agenda") continue;
      if (matrix[vote.mover] && matrix[vote.mover][vote.seconder] !== undefined) {
        matrix[vote.mover][vote.seconder]++;
      }
    }
  }

  // Find max for color scaling
  let maxCount = 0;
  for (const row of Object.values(matrix)) {
    for (const count of Object.values(row)) {
      if (count > maxCount) maxCount = count;
    }
  }

  function getCellBg(count: number): string {
    if (count === 0) return "bg-surface-container-low";
    const intensity = Math.min(count / Math.max(maxCount, 1), 1);
    // Map to opacity levels
    if (intensity > 0.8) return "bg-primary/70";
    if (intensity > 0.6) return "bg-primary/50";
    if (intensity > 0.4) return "bg-primary/35";
    if (intensity > 0.2) return "bg-primary/20";
    return "bg-primary/10";
  }

  function getCellText(count: number): string {
    if (count === 0) return "text-outline-variant";
    return count >= maxCount * 0.5 ? "text-white" : "text-primary";
  }

  const lastName = (id: string) => {
    const c = COMMISSIONERS.find((c) => c.id === id);
    return c?.name.split(" ").pop() ?? id;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider p-2 text-left">
              Mover ↓ / Seconder →
            </th>
            {COMMISSIONERS.map((c) => (
              <th key={c.id} className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider p-2 text-center">
                {lastName(c.id)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMMISSIONERS.map((mover) => (
            <tr key={mover.id}>
              <td className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider p-2">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: mover.color }} />
                  {lastName(mover.id)}
                </span>
              </td>
              {COMMISSIONERS.map((seconder) => {
                const count = matrix[mover.id][seconder.id];
                const isSelf = mover.id === seconder.id;
                return (
                  <td
                    key={seconder.id}
                    className={`p-2 text-center rounded ${isSelf ? "bg-surface-container-highest/30" : getCellBg(count)}`}
                  >
                    {isSelf ? (
                      <span className="text-[10px] text-outline-variant">—</span>
                    ) : (
                      <span className={`text-sm font-bold ${getCellText(count)}`}>
                        {count || "·"}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
