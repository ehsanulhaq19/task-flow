"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { HiBars3, HiOutlineStop } from "react-icons/hi2";
import toast from "react-hot-toast";
import DayLimitDialog from "@/components/DayLimitDialog";
import { useNow } from "@/hooks/useNow";
import { useScreenCapture } from "@/hooks/useScreenCapture";
import { dayLimits, dayStatus, stopTimerMessage } from "@/lib/dayLimits";
import { formatClock, formatHours } from "@/lib/format";
import { sumOverlap, todayRange } from "@/lib/time";
import { initials } from "@/lib/user";
import { stopTimer } from "@/store/slices/timeSlice";
import { selectOpenSession } from "@/store/selectors";
import { useAppDispatch, useAppSelector } from "@/store/store";

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/tasks": "Tasks",
  "/settings": "Settings",
};

type NavbarProps = {
  onMenuClick?: () => void;
};

function TimerWidget() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const open = useAppSelector(selectOpenSession);
  const sessions = useAppSelector((state) => state.time.sessions);
  const tasks = useAppSelector((state) => state.tasks.tasks);
  const now = useNow(Boolean(open));
  const [notice, setNotice] = useState("");
  const limits = dayLimits(user);
  const today = todayRange(new Date(now));
  const todayMs = sumOverlap(sessions, today.start, today.end, now);
  const underMinimum = dayStatus(todayMs, limits) === "under";
  const task = open?.taskId ? tasks.find((item) => item.id === open.taskId) : null;
  const elapsed = open ? Math.max(0, now - new Date(open.startedAt).getTime()) : 0;
  const tone = underMinimum
    ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-200"
    : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200";
  const dot = underMinimum ? "bg-rose-500" : "bg-emerald-500";

  return (
    <>
      <div className={`flex items-center gap-2 rounded-full border py-1 pl-2.5 ${open ? "pr-1" : "pr-2.5"} ${tone}`}>
        <span className={`h-2 w-2 rounded-full ${open ? "animate-pulse" : ""} ${dot}`} aria-hidden />
        <span className="font-mono text-sm font-semibold tabular-nums">
          {open ? formatClock(elapsed) : formatHours(todayMs)}
        </span>
        {task ? (
          <span className="hidden max-w-[7rem] truncate text-xs font-medium sm:inline">{task.key}</span>
        ) : null}
        {open ? (
          <button
            type="button"
            onClick={() => {
              const message = stopTimerMessage(todayMs, limits);
              void dispatch(stopTimer())
                .unwrap()
                .then(() => setNotice(message))
                .catch((err: unknown) => {
                  toast.error(typeof err === "string" ? err : "Could not stop the timer");
                });
            }}
            className={`rounded-full p-1 ${underMinimum ? "text-rose-700 hover:bg-rose-100 dark:text-rose-200 dark:hover:bg-rose-900/60" : "text-emerald-700 hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-900/60"}`}
            aria-label="Stop timer"
            title="Stop timer"
          >
            <HiOutlineStop className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {notice ? (
        <DayLimitDialog message={notice} confirmLabel="OK" onConfirm={() => setNotice("")} onClose={() => setNotice("")} />
      ) : null}
    </>
  );
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const pathname = usePathname();
  const user = useAppSelector((state) => state.auth.user);
  const capture = useScreenCapture();
  const title =
    routeTitles[pathname] ||
    Object.entries(routeTitles).find(([route]) => pathname.startsWith(route))?.[1] ||
    "Dashboard";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900 sm:h-16 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          className="-ml-1 rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 md:hidden"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
        >
          <HiBars3 className="h-6 w-6" />
        </button>
        <h1 className="truncate text-base font-semibold text-gray-900 dark:text-white sm:text-lg">
          {title}
        </h1>
      </div>
      {user ? (
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <TimerWidget />
          {capture.active ? (
            <span
              className="hidden text-xs font-medium text-gray-500 dark:text-gray-400 lg:inline"
              title="A screenshot is saved on the server at a random time between 1 and 10 minutes"
            >
              Screenshots on
            </span>
          ) : null}
          <span className="hidden max-w-[12rem] truncate text-sm text-gray-600 dark:text-gray-400 sm:inline">
            {user.firstName} {user.lastName}
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700 dark:bg-primary-900/60 dark:text-primary-300">
            {initials(user)}
          </span>
        </div>
      ) : null}
    </header>
  );
}
