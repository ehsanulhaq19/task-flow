"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cardClass } from "@/constants/ui";
import { useAppSelector } from "@/store/store";
import type { TimeLogSeries } from "@/services/admin";

const COLORS = ["#2563eb", "#0f766e", "#c2410c", "#7c3aed", "#be123c", "#a16207", "#0369a1", "#4d7c0f"];

const RANGE_COPY = {
  daily: { title: "Daily hours", text: "Logged hours for the last 14 days, with each person's minimum and maximum." },
  weekly: { title: "Weekly hours", text: "Logged hours for the last 12 weeks. Limits are the daily minimum and maximum times seven." },
  monthly: { title: "Monthly hours", text: "Logged hours for the last 12 months. Limits scale by the days in each month." },
};

function TimeTooltip({
  active,
  payload,
  names,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number | string; payload?: Record<string, string | number> }>;
  names: Record<string, string>;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row || !payload) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
      <p className="font-medium text-gray-900 dark:text-white">{row.full}</p>
      {payload.map((item) => {
        const key = String(item.dataKey ?? "");
        const hours = typeof item.value === "number" ? item.value : 0;
        const minimum = Number(row[`${key}:min`] ?? 0);
        const maximum = Number(row[`${key}:max`] ?? 0);
        const covered = hours >= minimum ? "minimum covered" : "under minimum";
        return (
          <p key={key} className="mt-1">
            {names[key] ?? key}: {hours}h logged · min {minimum}h · max {maximum}h · {covered}
          </p>
        );
      })}
    </div>
  );
}

export default function AdminTimeChart({
  range,
  series,
}: {
  range: "daily" | "weekly" | "monthly";
  series: TimeLogSeries[];
}) {
  const mode = useAppSelector((state) => state.theme.mode);
  const axis = mode === "dark" ? "#9ca3af" : "#6b7280";
  const grid = mode === "dark" ? "#1f2937" : "#e5e7eb";
  const copy = RANGE_COPY[range];
  const names = Object.fromEntries(series.map((item) => [item.userId, item.userName]));
  const points = series[0]?.points ?? [];
  const data = points.map((point, index) => {
    const row: Record<string, string | number> = { label: point.label, full: point.full };
    series.forEach((item) => {
      const bucket = item.points[index];
      row[item.userId] = bucket?.hours ?? 0;
      row[`${item.userId}:min`] = bucket?.minimumHours ?? 0;
      row[`${item.userId}:max`] = bucket?.maximumHours ?? 0;
    });
    return row;
  });
  const single = series.length === 1 ? series[0] : null;
  const constantLimits =
    single &&
    single.points.length > 0 &&
    single.points.every(
      (point) => point.minimumHours === single.points[0].minimumHours && point.maximumHours === single.points[0].maximumHours,
    );

  return (
    <section className={`${cardClass} p-5`} aria-label="Time log chart">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{copy.title}</h2>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{copy.text}</p>
      <div className="mt-4 h-64">
        {data.length === 0 ? (
          <p className="text-sm text-gray-500">No people match this organization.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid stroke={grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: axis, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: axis, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals />
              <Tooltip
                cursor={{ fill: mode === "dark" ? "#111827" : "#f3f4f6" }}
                content={<TimeTooltip names={names} />}
              />
              {constantLimits && single ? (
                <ReferenceLine y={single.points[0].minimumHours} stroke="#e11d48" strokeDasharray="4 4" />
              ) : null}
              {constantLimits && single ? (
                <ReferenceLine y={single.points[0].maximumHours} stroke="#059669" strokeDasharray="4 4" />
              ) : null}
              {series.map((item, index) => (
                <Bar
                  key={item.userId}
                  dataKey={item.userId}
                  stackId="hours"
                  fill={COLORS[index % COLORS.length]}
                  maxBarSize={36}
                  radius={index === series.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      {series.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {series.map((item, index) => (
            <li key={item.userId} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
              {item.userName}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
