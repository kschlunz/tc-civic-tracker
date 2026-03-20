"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import type { Meeting } from "@/lib/types";

interface ActivitySparklineProps {
  commissionerId: string;
  meetings: Meeting[];
  color: string;
}

export default function ActivitySparkline({ commissionerId, meetings, color }: ActivitySparklineProps) {
  const data = meetings
    .filter((m) => m.attendees.includes(commissionerId))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({
      date: new Date(m.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      topics: m.commissionerActivity[commissionerId]?.topics.length || 0,
    }));

  if (data.length < 2) return null;

  return (
    <div className="w-full" style={{ height: 80 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${commissionerId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" hide />
          <YAxis hide domain={[0, "auto"]} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#f9f9f8",
              border: "1px solid #c3c8c1",
              borderRadius: 4,
              fontSize: 11,
              fontFamily: "Manrope",
            }}
            formatter={(value) => [`${value} topics`, ""]}
            labelStyle={{ fontWeight: 700, fontSize: 10, textTransform: "uppercase" as const }}
          />
          <Area
            type="monotone"
            dataKey="topics"
            stroke={color}
            strokeWidth={2}
            fill={`url(#spark-${commissionerId})`}
            dot={false}
            activeDot={{ r: 3, fill: color }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
