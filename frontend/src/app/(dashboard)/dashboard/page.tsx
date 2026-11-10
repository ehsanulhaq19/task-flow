"use client";

import {
  HiOutlineArrowRightOnRectangle,
  HiOutlineCalendarDays,
  HiOutlineClock,
  HiOutlineRectangleStack,
} from "react-icons/hi2";
import CurrentTaskCard from "@/components/CurrentTaskCard";
import HoursChart from "@/components/HoursChart";
import RecentSessions from "@/components/RecentSessions";
import StatCard from "@/components/StatCard";
import TimerCard from "@/components/TimerCard";
import { useNow } from "@/hooks/useNow";
import { formatDay, formatHours, formatRange, formatTime, greeting, whenLabel } from "@/lib/format";
import { lastDayRange, lastTimeIn, lastTimeOut, lastWeekRange, recentDays, sumOverlap } from "@/lib/time";
import { selectCurrentTask, selectOpenSession } from "@/store/selectors";
import { useAppSelector } from "@/store/store";

export default function DashboardPage() {
  const nowMs = useNow(true);
  const now = new Date(nowMs);
  const user = useAppSelector((state) => state.auth.user);
  const sessions = useAppSelector((state) => state.time.sessions);
  const tasks = useAppSelector((state) => state.tasks.tasks);
  const current = useAppSelector(selectCurrentTask);
  const open = useAppSelector(selectOpenSession);

  const timeIn = lastTimeIn(sessions);
  const timeOut = lastTimeOut(sessions);
  const yesterday = lastDayRange(now);
  const week = lastWeekRange(now);
  const yesterdayMs = sumOverlap(sessions, yesterday.start, yesterday.end, nowMs);
  const weekMs = sumOverlap(sessions, week.start, week.end, nowMs);

  return (
    <div className="h-full space-y-6 overflow-y-auto pr-1">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {greeting(now)}, {user?.firstName}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{formatDay(now)}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Last time in"
          value={formatTime(timeIn)}
          hint={whenLabel(timeIn, now)}
          icon={HiOutlineClock}
          accent="bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400"
        />
        <StatCard
          label="Last time out"
          value={formatTime(timeOut)}
          hint={whenLabel(timeOut, now)}
          icon={HiOutlineArrowRightOnRectangle}
          accent="bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
        />
        <StatCard
          label="Last day"
          value={formatHours(yesterdayMs)}
          hint={formatDay(yesterday.start)}
          icon={HiOutlineCalendarDays}
          accent="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
        />
        <StatCard
          label="Last week"
          value={formatHours(weekMs)}
          hint={formatRange(week.start, week.end)}
          icon={HiOutlineRectangleStack}
          accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
        />
      </div>

      <div className="mx-auto w-full max-w-3xl">
        <TimerCard now={nowMs} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CurrentTaskCard task={current} timing={Boolean(open && current && open.taskId === current.id)} />
        <HoursChart points={recentDays(sessions, 7, now)} />
      </div>

      <RecentSessions sessions={sessions} tasks={tasks} now={nowMs} />
    </div>
  );
}
