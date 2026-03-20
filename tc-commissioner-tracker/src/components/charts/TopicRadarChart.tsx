"use client";

import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";
import { CATEGORIES, CATEGORY_ICONS } from "@/lib/constants";
import type { Meeting } from "@/lib/types";

interface TopicRadarChartProps {
  commissionerId: string;
  meetings: Meeting[];
  color: string;
  /** Mini mode: no labels, smaller */
  mini?: boolean;
}

function getCategoryCounts(commissionerId: string, meetings: Meeting[]) {
  const counts: Record<string, number> = {};
  for (const cat of CATEGORIES) {
    counts[cat.id] = 0;
  }
  for (const meeting of meetings) {
    const activity = meeting.commissionerActivity[commissionerId];
    if (!activity) continue;
    for (const topic of activity.topics) {
      for (const cat of topic.categories) {
        counts[cat] = (counts[cat] || 0) + 1;
      }
    }
  }
  return CATEGORIES.map((cat) => ({
    category: cat.label,
    shortLabel: cat.label.split(" ")[0],
    icon: CATEGORY_ICONS[cat.id] || "",
    value: counts[cat.id] || 0,
  }));
}

export default function TopicRadarChart({ commissionerId, meetings, color, mini = false }: TopicRadarChartProps) {
  const data = getCategoryCounts(commissionerId, meetings);
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div style={{ width: mini ? 200 : 350, height: mini ? 200 : 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} cx="50%" cy="50%" outerRadius={mini ? "70%" : "65%"}>
          <PolarGrid stroke="#c3c8c1" strokeOpacity={0.3} />
          {!mini && (
            <PolarAngleAxis
              dataKey="shortLabel"
              tick={{ fontSize: 10, fill: "#434843", fontWeight: 600 }}
              tickLine={false}
            />
          )}
          <Radar
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.15}
            strokeWidth={2}
            dot={!mini}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
