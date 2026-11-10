"use client";

import { useMemo, useState } from "react";
import KanbanBoard, { type BoardCard } from "@/components/KanbanBoard";
import TaskModal, { draftFromTask, emptyDraft } from "@/components/TaskModal";
import { PRIORITIES, PRIORITY_LABEL } from "@/constants/task";
import { fieldClass, primaryButtonClass } from "@/constants/ui";
import { fullName } from "@/lib/user";
import { moveTask } from "@/store/slices/taskSlice";
import { useAppDispatch, useAppSelector } from "@/store/store";
import type { Priority, TaskStatus } from "@/types";

export default function TasksPage() {
  const dispatch = useAppDispatch();
  const tasks = useAppSelector((state) => state.tasks.tasks);
  const user = useAppSelector((state) => state.auth.user);
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [draft, setDraft] = useState<ReturnType<typeof emptyDraft> | null>(null);
  const me = user ? fullName(user) : "";

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (priority !== "all" && task.priority !== priority) return false;
      const assignedToMe = task.assigneeUserId ? task.assigneeUserId === user?.id : task.assignee === me;
      if (mineOnly && !assignedToMe) return false;
      if (!needle) return true;
      const haystack = [task.key, task.title, task.assignee, ...task.labels].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [tasks, query, priority, mineOnly, me, user?.id]);

  const openCreate = (status: TaskStatus) => {
    setDraft(emptyDraft(status, user?.id ?? ""));
  };

  const openEdit = (card: BoardCard) => {
    const task = tasks.find((item) => item.id === card.id);
    if (task) setDraft(draftFromTask(task));
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Board</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {visible.length} of {tasks.length} tasks. Drag a card to change its column.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tasks"
            className={`${fieldClass} sm:w-52`}
            aria-label="Search tasks"
          />
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as Priority | "all")}
            className={`${fieldClass} sm:w-36`}
            aria-label="Filter by priority"
          >
            <option value="all">All priorities</option>
            {PRIORITIES.map((item) => (
              <option key={item} value={item}>
                {PRIORITY_LABEL[item]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setMineOnly((current) => !current)}
            className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
              mineOnly
                ? "border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
                : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            }`}
          >
            Mine
          </button>
          <button type="button" onClick={() => openCreate("todo")} className={primaryButtonClass}>
            New task
          </button>
        </div>
      </div>
      <KanbanBoard
        tasks={visible}
        onOpen={openEdit}
        onCreate={openCreate}
        onMove={(id, status) => dispatch(moveTask({ id, status })).unwrap()}
      />
      {draft ? <TaskModal draft={draft} onClose={() => setDraft(null)} /> : null}
    </div>
  );
}
