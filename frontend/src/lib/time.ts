import type { TimeSession } from "@/types";

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeekMonday(date: Date) {
  const start = startOfDay(date);
  const day = start.getDay();
  const diff = day === 0 ? 6 : day - 1;
  return addDays(start, -diff);
}

export function lastDayRange(now = new Date()) {
  const end = startOfDay(now);
  return { start: addDays(end, -1), end };
}

export function lastWeekRange(now = new Date()) {
  const end = startOfWeekMonday(now);
  return { start: addDays(end, -7), end };
}

export function todayRange(now = new Date()) {
  const start = startOfDay(now);
  return { start, end: addDays(start, 1) };
}

function overlapMs(
  session: TimeSession,
  rangeStart: number,
  rangeEnd: number,
  now: number
) {
  const start = new Date(session.startedAt).getTime();
  const end = session.endedAt ? new Date(session.endedAt).getTime() : now;
  return Math.max(0, Math.min(end, rangeEnd) - Math.max(start, rangeStart));
}

export function sumOverlap(
  sessions: TimeSession[],
  rangeStart: Date,
  rangeEnd: Date,
  now = Date.now()
) {
  const from = rangeStart.getTime();
  const to = rangeEnd.getTime();
  return sessions.reduce(
    (total, session) => total + overlapMs(session, from, to, now),
    0
  );
}

export function lastTimeIn(sessions: TimeSession[]) {
  if (sessions.length === 0) return null;
  return sessions.reduce(
    (latest, session) => (session.startedAt > latest ? session.startedAt : latest),
    sessions[0].startedAt
  );
}

export function lastTimeOut(sessions: TimeSession[]) {
  const ended = sessions.filter((session) => session.endedAt);
  if (ended.length === 0) return null;
  return ended.reduce((latest, session) => {
    const value = session.endedAt as string;
    return value > latest ? value : latest;
  }, ended[0].endedAt as string);
}

export function recentDays(sessions: TimeSession[], days: number, now = new Date()) {
  const today = startOfDay(now);
  return Array.from({ length: days }, (_, index) => {
    const day = addDays(today, index - (days - 1));
    const ms = sumOverlap(sessions, day, addDays(day, 1), now.getTime());
    return {
      label: day.toLocaleDateString(undefined, { weekday: "short" }),
      full: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      hours: Math.round((ms / 3_600_000) * 10) / 10,
    };
  });
}
