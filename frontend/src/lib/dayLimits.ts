import type { User } from "@/types";

export type DayLimits = {
  minimumHours: number;
  maximumHours: number;
};

export function dayLimits(user: Pick<User, "configurationData" | "dailyTargetHours"> | null | undefined): DayLimits {
  const minimum = user?.configurationData?.minimumHours ?? user?.dailyTargetHours ?? 8;
  const maximum = Math.max(minimum, user?.configurationData?.maximumHours ?? minimum);
  return { minimumHours: minimum, maximumHours: maximum };
}

export function startTimerMessage(todayMs: number, limits: DayLimits) {
  const minimumMs = limits.minimumHours * 3_600_000;
  const maximumMs = limits.maximumHours * 3_600_000;
  if (todayMs >= maximumMs) return "You are exceeded to daily hours limit, take some rest.";
  const remaining = minimumMs - todayMs;
  if (remaining <= 0) return "You have completed today's minimum.";
  return `You must log ${formatRemaining(remaining)} to mark today's day completed.`;
}

export function stopTimerMessage(todayMs: number, limits: DayLimits) {
  const minimumMs = limits.minimumHours * 3_600_000;
  const maximumMs = limits.maximumHours * 3_600_000;
  if (todayMs >= maximumMs) return "You have reached the limit, take some rest.";
  const remaining = minimumMs - todayMs;
  if (remaining <= 0) return "You have completed today's minimum.";
  return `You must log ${formatRemaining(remaining)} to mark today's day completed.`;
}

export function dayStatus(todayMs: number, limits: DayLimits): "under" | "met" {
  return todayMs >= limits.minimumHours * 3_600_000 ? "met" : "under";
}

function formatRemaining(ms: number) {
  const totalMinutes = Math.max(1, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} more minutes`;
  if (minutes === 0) return `${hours} more hours`;
  return `${hours}h ${minutes}m more`;
}
