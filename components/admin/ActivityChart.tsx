"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface ChartPoint {
  week: string;
  count: number;
}

export function ActivityChart({ data }: { data: ChartPoint[] }) {
  return (
    <div className="aiesec-card mb-6 px-6 pb-4 pt-5">
      <p className="pulse-label mb-4">Posts per week — last 8 weeks</p>
      <ResponsiveContainer width="100%" height={176}>
        <BarChart data={data} barCategoryGap="32%">
          <XAxis
            dataKey="week"
            axisLine={{ stroke: "var(--border)", strokeWidth: 1 }}
            tickLine={false}
            tick={{
              fill: "var(--muted-foreground)",
              fontSize: 12,
              fontFamily: "Lato, Arial, sans-serif",
            }}
          />
          <YAxis hide />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 13,
              color: "var(--foreground)",
              fontFamily: "Lato, Arial, sans-serif",
              boxShadow: "none",
            }}
            itemStyle={{ color: "var(--foreground)" }}
            formatter={(value) => [value, "Posts"]}
            labelStyle={{ color: "var(--muted-foreground)", fontWeight: 500 }}
          />
          <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
