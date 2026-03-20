"use client";

import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import type { FollowUpItem } from "@/lib/types";

interface FollowThroughRateProps {
  followUps: FollowUpItem[];
  statusOverrides: Record<string, string>;
}

function getEffectiveStatus(item: FollowUpItem, overrides: Record<string, string>): string {
  return overrides[item.id] || item.status;
}

export default function FollowThroughRate({ followUps, statusOverrides }: FollowThroughRateProps) {
  const total = followUps.length;
  const resolved = followUps.filter((f) => {
    const s = getEffectiveStatus(f, statusOverrides);
    return s === "resolved";
  }).length;
  const open = followUps.filter((f) => {
    const s = getEffectiveStatus(f, statusOverrides);
    return s === "open" || s === "in_progress";
  }).length;
  const dropped = total - resolved - open;

  const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const hasEnoughData = total >= 3;

  // Color based on rate
  let rateColor = "#737973"; // gray
  if (hasEnoughData) {
    if (rate >= 75) rateColor = "#4d6453"; // green (primary-ish)
    else if (rate >= 50) rateColor = "#d97706"; // amber
    else rateColor = "#ba1a1a"; // red
  }

  const chartData = hasEnoughData
    ? [
        { name: "Resolved", value: resolved },
        { name: "Remaining", value: Math.max(total - resolved, 0) },
      ]
    : [
        { name: "Resolved", value: 0 },
        { name: "Remaining", value: 1 },
      ];

  return (
    <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant/20">
      <h4 className="font-headline text-lg font-bold text-primary mb-4">Follow-Through Rate</h4>
      <div className="flex items-center gap-6">
        {/* Donut */}
        <div className="relative" style={{ width: 120, height: 120 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={38}
                outerRadius={55}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
                strokeWidth={0}
              >
                <Cell fill={rateColor} />
                <Cell fill="#e1e3e2" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-headline text-2xl font-bold" style={{ color: rateColor }}>
              {hasEnoughData ? `${rate}%` : "—"}
            </span>
          </div>
        </div>
        {/* Stats */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-on-surface-variant">{total} total items</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary" />
            <span className="text-on-surface-variant">{resolved} resolved</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-error" />
            <span className="text-on-surface-variant">{open} open</span>
          </div>
          {dropped > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-outline" />
              <span className="text-on-surface-variant">{dropped} dropped</span>
            </div>
          )}
          {!hasEnoughData && (
            <p className="text-[10px] text-on-surface-variant italic mt-1">Fewer than 3 items — not enough data</p>
          )}
        </div>
      </div>
    </div>
  );
}
