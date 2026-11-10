import Link from "next/link";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/constants/task";
import { cardClass } from "@/constants/ui";
import type { Task } from "@/types";

const priorityClass: Record<Task["priority"], string> = {
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  medium: "bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300",
  high: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  urgent: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};

export default function CurrentTaskCard({ task, timing }: { task: Task | null; timing: boolean }) {
  return (
    <section className={`${cardClass} flex h-full flex-col p-5`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Current task</h2>
        <Link href="/tasks" className="text-sm font-medium text-primary-600 hover:text-primary-500">
          Open board
        </Link>
      </div>
      {task ? (
        <div className="mt-4 flex flex-1 flex-col">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{task.key}</p>
          <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{task.title}</h3>
          <p className="mt-2 line-clamp-3 text-sm text-gray-600 dark:text-gray-400">{task.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${priorityClass[task.priority]}`}>
              {PRIORITY_LABEL[task.priority]}
            </span>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {STATUS_LABEL[task.status]}
            </span>
            {timing ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                Timer running
              </span>
            ) : null}
          </div>
          <p className="mt-auto pt-4 text-sm text-gray-500 dark:text-gray-400">{task.assignee}</p>
        </div>
      ) : (
        <div className="mt-6 flex flex-1 flex-col justify-center rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center dark:border-gray-700">
          <p className="text-sm font-medium text-gray-900 dark:text-white">Nothing in progress</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Move a card to In Progress, or start the timer on a task.
          </p>
        </div>
      )}
    </section>
  );
}
