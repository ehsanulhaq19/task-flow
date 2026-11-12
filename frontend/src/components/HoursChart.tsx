"use client";

import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cardClass } from "@/constants/ui";
import { useAppSelector } from "@/store/store";

type Point = { label: string; full: string; hours: number; minimumHours: number; maximumHours: number };

function LimitTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: Point }>;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const covered = point.hours >= point.minimumHours ? "Minimum covered" : "Under the minimum";
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
      <p className="font-medium text-gray-900 dark:text-white">{point.full}</p>
      <p className="mt-1">{point.hours}h logged</p>
      <p>Minimum {point.minimumHours}h · Maximum {point.maximumHours}h</p>
      <p>{covered}</p>
    </div>
  );
}

export default function HoursChart({ points }: { points: Point[] }) {
  const mode = useAppSelector((state) => state.theme.mode);
  const axis = mode === "dark" ? "#9ca3af" : "#6b7280";
  const grid = mode === "dark" ? "#1f2937" : "#e5e7eb";
  const minimum = points[0]?.minimumHours ?? 0;
  const maximum = points[0]?.maximumHours ?? 0;

  return (
    <section className={`${cardClass} p-5`}>
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Last 7 days</h2>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Logged hours against a {minimum}h minimum and {maximum}h maximum.
      </p>
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke={grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: axis, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: axis, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals />
            <Tooltip cursor={{ fill: mode === "dark" ? "#111827" : "#f3f4f6" }} content={<LimitTooltip />} />
            <ReferenceLine y={minimum} stroke="#e11d48" strokeDasharray="4 4" />
            <ReferenceLine y={maximum} stroke="#059669" strokeDasharray="4 4" />
            <Bar dataKey="hours" radius={[6, 6, 0, 0]} maxBarSize={36}>
              {points.map((point, index) => (
                <Cell key={`${point.full}-${index}`} fill={point.hours >= point.minimumHours ? "#059669" : "#e11d48"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
