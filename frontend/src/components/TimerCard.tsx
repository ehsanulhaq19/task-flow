"use client";

import { useEffect, useState } from "react";
import { HiOutlinePlay, HiOutlineStop } from "react-icons/hi2";
import toast from "react-hot-toast";
import { cardClass, fieldClass } from "@/constants/ui";
import { formatClock, formatHours } from "@/lib/format";
import { sumOverlap, todayRange } from "@/lib/time";
import { beginScreenCapture, stopScreenCapture } from "@/services/screenCapture";
import { startTimer, stopTimer } from "@/store/slices/timeSlice";
import { selectOpenSession } from "@/store/selectors";
import { useAppDispatch, useAppSelector } from "@/store/store";

type TimerCardProps = {
  now: number;
};

export default function TimerCard({ now }: TimerCardProps) {
  const dispatch = useAppDispatch();
  const tasks = useAppSelector((state) => state.tasks.tasks);
  const sessions = useAppSelector((state) => state.time.sessions);
  const target = useAppSelector((state) => state.settings.dailyTargetHours);
  const open = useAppSelector(selectOpenSession);
  const [selectedId, setSelectedId] = useState("");

  const currentInProgress = tasks
    .filter((task) => task.status === "in_progress")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  useEffect(() => {
    if (open) return;
    setSelectedId(currentInProgress?.id ?? "");
  }, [open, currentInProgress?.id]);

  const activeTask = open?.taskId ? tasks.find((task) => task.id === open.taskId) ?? null : null;
  const inProgress = tasks
    .filter((task) => task.status === "in_progress")
    .sort((a, b) => a.key.localeCompare(b.key));
  const elapsed = open ? Math.max(0, now - new Date(open.startedAt).getTime()) : 0;
  const today = todayRange(new Date(now));
  const todayMs = sumOverlap(sessions, today.start, today.end, now);
  const targetMs = target * 3_600_000;
  const progress = targetMs > 0 ? Math.min(100, Math.round((todayMs / targetMs) * 100)) : 0;

  const handleStart = async () => {
    const task = inProgress.find((item) => item.id === selectedId);
    if (!task) {
      toast.error("Choose a task that is in progress");
      return;
    }
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

  const handleStop = async () => {
    try {
      await dispatch(stopTimer()).unwrap();
      stopScreenCapture();
      toast.success("Timed out");
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Could not stop the timer");
    }
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
        <div className="mb-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Today {formatHours(todayMs)}</span>
          <span>
            Target {target}h · {progress}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className="h-full rounded-full bg-primary-600 transition-all"
            style={{ width: `${progress}%` }}
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
            Move a task to In Progress before starting the timer.
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
            onClick={handleStart}
            disabled={!selectedId}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <HiOutlinePlay className="h-5 w-5" />
            Start timer
          </button>
        )}
      </div>
    </section>
  );
}
