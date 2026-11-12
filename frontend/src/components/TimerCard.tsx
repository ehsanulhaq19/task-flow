"use client";

import { useEffect, useState } from "react";
import { HiOutlinePlay, HiOutlineStop } from "react-icons/hi2";
import toast from "react-hot-toast";
import DayLimitDialog from "@/components/DayLimitDialog";
import { cardClass, fieldClass } from "@/constants/ui";
import { dayLimits, dayStatus, startTimerMessage, stopTimerMessage } from "@/lib/dayLimits";
import { formatClock, formatHours } from "@/lib/format";
import { sumOverlap, todayRange } from "@/lib/time";
import { fullName } from "@/lib/user";
import { beginScreenCapture, stopScreenCapture } from "@/services/screenCapture";
import { startTimer, stopTimer } from "@/store/slices/timeSlice";
import { selectOpenSession } from "@/store/selectors";
import { useAppDispatch, useAppSelector } from "@/store/store";

type TimerCardProps = {
  now: number;
};

export default function TimerCard({ now }: TimerCardProps) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const tasks = useAppSelector((state) => state.tasks.tasks);
  const sessions = useAppSelector((state) => state.time.sessions);
  const open = useAppSelector(selectOpenSession);
  const [selectedId, setSelectedId] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingStart, setPendingStart] = useState(false);
  const limits = dayLimits(user);
  const me = user ? fullName(user) : "";
  const mineInProgress = tasks.filter((task) => {
    if (task.status !== "in_progress") return false;
    return task.assigneeUserId ? task.assigneeUserId === user?.id : task.assignee === me;
  });

  const currentInProgress = [...mineInProgress].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  useEffect(() => {
    if (open) return;
    setSelectedId(currentInProgress?.id ?? "");
  }, [open, currentInProgress?.id]);

  const activeTask = open?.taskId ? tasks.find((task) => task.id === open.taskId) ?? null : null;
  const inProgress = [...mineInProgress].sort((a, b) => a.key.localeCompare(b.key));
  const elapsed = open ? Math.max(0, now - new Date(open.startedAt).getTime()) : 0;
  const today = todayRange(new Date(now));
  const todayMs = sumOverlap(sessions, today.start, today.end, now);
  const minimumMs = limits.minimumHours * 3_600_000;
  const maximumMs = limits.maximumHours * 3_600_000;
  const progress = maximumMs > 0 ? Math.min(100, (todayMs / maximumMs) * 100) : 0;
  const minimumMark = maximumMs > 0 ? Math.min(100, (minimumMs / maximumMs) * 100) : 0;
  const underMinimum = dayStatus(todayMs, limits) === "under";
  const overLimit = notice === "You are exceeded to daily hours limit, take some rest.";

  const beginTiming = async () => {
    const task = inProgress.find((item) => item.id === selectedId);
    if (!task) {
      toast.error("Choose a task that is in progress");
      return;
    }
    setNotice("");
    setPendingStart(false);
    void beginScreenCapture().catch(() => {
      toast.error("Allow screen sharing to save screenshots");
    });
    try {
      await dispatch(startTimer({ taskId: task.id })).unwrap();
      toast.success(`Timed in on ${task.key}`);
    } catch (err) {
      stopScreenCapture();
      toast.error(typeof err === "string" ? err : "Could not start the timer");
    }
  };

  const requestStart = () => {
    const task = inProgress.find((item) => item.id === selectedId);
    if (!task) {
      toast.error("Choose a task that is in progress");
      return;
    }
    setPendingStart(true);
    setNotice(startTimerMessage(todayMs, limits));
  };

  const handleStop = async () => {
    const message = stopTimerMessage(todayMs, limits);
    try {
      await dispatch(stopTimer()).unwrap();
      stopScreenCapture();
      setPendingStart(false);
      setNotice(message);
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Could not stop the timer");
    }
  };

  const closeNotice = () => {
    setNotice("");
    setPendingStart(false);
  };

  return (
    <section className={`${cardClass} relative overflow-hidden p-6 sm:p-8`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-400 via-primary-600 to-primary-800" />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Time tracker</p>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
            open
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${open ? "animate-pulse bg-emerald-500" : "bg-gray-400"}`} />
          {open ? "Timing" : "Idle"}
        </span>
      </div>

      <p className="mt-6 text-center font-mono text-5xl font-semibold tabular-nums tracking-tight text-gray-900 dark:text-white sm:text-6xl">
        {formatClock(elapsed)}
      </p>
      <p className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
        {open
          ? activeTask
            ? activeTask.title
            : "General time"
          : "Start the timer to log a time in"}
      </p>

      <div className="mx-auto mt-6 max-w-md">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span>Today {formatHours(todayMs)}</span>
          <span>
            Minimum {limits.minimumHours}h · Maximum {limits.maximumHours}h
          </span>
        </div>
        <div className="relative h-2 rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className={`h-full rounded-full transition-all ${underMinimum ? "bg-rose-600" : "bg-emerald-600"}`}
            style={{ width: `${progress}%` }}
          />
          <span
            className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-gray-900 dark:bg-white"
            style={{ left: `${minimumMark}%` }}
            title={`Minimum ${limits.minimumHours}h`}
          />
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-md space-y-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="timer-task">
          Task
        </label>
        <select
          id="timer-task"
          className={fieldClass}
          value={open?.taskId && inProgress.some((task) => task.id === open.taskId) ? open.taskId : selectedId}
          disabled={Boolean(open) || inProgress.length === 0}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {inProgress.length === 0 ? <option value="">No task in progress</option> : null}
          {inProgress.map((task) => (
            <option key={task.id} value={task.id}>
              {task.key} · {task.title}
            </option>
          ))}
        </select>
        {inProgress.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Move one of your tasks to In Progress before starting the timer.
          </p>
        ) : null}

        {open ? (
          <button
            type="button"
            onClick={handleStop}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-rose-700"
          >
            <HiOutlineStop className="h-5 w-5" />
            Stop timer
          </button>
        ) : (
          <button
            type="button"
            onClick={requestStart}
            disabled={!selectedId}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <HiOutlinePlay className="h-5 w-5" />
            Start timer
          </button>
        )}
      </div>
      {notice ? (
        <DayLimitDialog
          message={notice}
          confirmLabel={pendingStart ? (overLimit ? "Take a rest" : "Start timer") : "OK"}
          secondaryLabel={pendingStart ? (overLimit ? "Start anyway" : "Cancel") : undefined}
          onConfirm={pendingStart && !overLimit ? () => void beginTiming() : closeNotice}
          onSecondary={pendingStart ? (overLimit ? () => void beginTiming() : closeNotice) : undefined}
          onClose={closeNotice}
        />
      ) : null}
    </section>
  );
}
