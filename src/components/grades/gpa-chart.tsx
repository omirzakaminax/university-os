"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface GpaPoint { label: string; gpa: number }

/** GPA per academic period. Bars (not a trend line) because periods are discrete and may be sparse. */
export function GpaChart({ data, max }: { data: GpaPoint[]; max: number }) {
  return (
    <div className="h-52 w-full" role="img" aria-label={`GPA by period: ${data.map((d) => `${d.label} ${d.gpa.toFixed(2)}`).join(", ")}`}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, max]} tick={{ fill: "var(--subtle)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "var(--hover)" }} contentStyle={{ background: "var(--raised)", border: "1px solid var(--line-strong)", borderRadius: 8, fontSize: 12, color: "var(--fg)" }} labelStyle={{ color: "var(--fg)" }} itemStyle={{ color: "var(--fg)" }} formatter={(v) => [Number(v).toFixed(2), "GPA"]} />
          <Bar dataKey="gpa" radius={[4, 4, 0, 0]} maxBarSize={44}>
            {data.map((_, i) => <Cell key={i} fill={i === data.length - 1 ? "var(--accent)" : "var(--sky)"} fillOpacity={i === data.length - 1 ? 1 : 0.55} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
