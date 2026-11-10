import { cardClass } from "@/constants/ui";
import { formatHours, formatTime } from "@/lib/format";
import type { Task, TimeSession } from "@/types";

type RecentSessionsProps = {
  sessions: TimeSession[];
  tasks: Task[];
  now: number;
};

export default function RecentSessions({ sessions, tasks, now }: RecentSessionsProps) {
  const rows = [...sessions]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 6);

  return (
    <section className={`${cardClass} p-5`}>
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Recent time entries</h2>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Latest time in and time out records.</p>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">No time logged yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((session) => {
            const task = session.taskId ? tasks.find((item) => item.id === session.taskId) : null;
            const endMs = session.endedAt ? new Date(session.endedAt).getTime() : now;
            const duration = Math.max(0, endMs - new Date(session.startedAt).getTime());
            return (
              <li key={session.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                    {task ? `${task.key} · ${task.title}` : session.taskId ? "Removed task" : "General time"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTime(session.startedAt)} – {session.endedAt ? formatTime(session.endedAt) : "now"}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums text-gray-700 dark:text-gray-200">
                  {session.endedAt ? formatHours(duration) : "Running"}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
