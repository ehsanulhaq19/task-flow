"use client";

import { usePathname } from "next/navigation";
import { HiBars3, HiOutlineStop } from "react-icons/hi2";
import toast from "react-hot-toast";
import { formatClock } from "@/lib/format";
import { initials } from "@/lib/user";
import { useNow } from "@/hooks/useNow";
import { useScreenCapture } from "@/hooks/useScreenCapture";
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
  const open = useAppSelector(selectOpenSession);
  const tasks = useAppSelector((state) => state.tasks.tasks);
  const now = useNow(Boolean(open));
  if (!open) return null;

  const task = open.taskId ? tasks.find((item) => item.id === open.taskId) : null;
  const elapsed = Math.max(0, now - new Date(open.startedAt).getTime());

  return (
    <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 py-1 pl-2.5 pr-1 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200">
      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden />
      <span className="font-mono text-sm font-semibold tabular-nums">{formatClock(elapsed)}</span>
      {task ? (
        <span className="hidden max-w-[7rem] truncate text-xs font-medium sm:inline">{task.key}</span>
      ) : null}
      <button
        type="button"
        onClick={() => {
          void dispatch(stopTimer())
            .unwrap()
            .then(() => toast.success("Timed out"))
            .catch((err: unknown) => {
              toast.error(typeof err === "string" ? err : "Could not stop the timer");
            });
        }}
        className="rounded-full p-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
        aria-label="Stop timer"
        title="Stop timer"
      >
        <HiOutlineStop className="h-4 w-4" />
      </button>
    </div>
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
