"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cardClass } from "@/constants/ui";
import { useAppSelector } from "@/store/store";

type Point = { label: string; full: string; hours: number };

export default function HoursChart({ points }: { points: Point[] }) {
  const mode = useAppSelector((state) => state.theme.mode);
  const axis = mode === "dark" ? "#9ca3af" : "#6b7280";
  const grid = mode === "dark" ? "#1f2937" : "#e5e7eb";

  return (
    <section className={`${cardClass} p-5`}>
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Last 7 days</h2>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Hours logged each day, including today.</p>
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid stroke={grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: axis, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: axis, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals />
            <Tooltip
              cursor={{ fill: mode === "dark" ? "#111827" : "#f3f4f6" }}
              contentStyle={{
                background: mode === "dark" ? "#111827" : "#ffffff",
                border: `1px solid ${grid}`,
                borderRadius: 8,
                color: mode === "dark" ? "#f9fafb" : "#111827",
              }}
              formatter={(value) => [
                `${typeof value === "number" ? value.toFixed(1) : value}h`,
                "Logged",
              ]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ""}
            />
            <Bar dataKey="hours" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
