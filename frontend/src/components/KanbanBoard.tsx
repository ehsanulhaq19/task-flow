"use client";

import { useRef, useState } from "react";
import { HiOutlineChatBubbleLeft, HiOutlinePlus } from "react-icons/hi2";
import toast from "react-hot-toast";
import { RichText } from "@/components/RichTextEditor";
import { COLUMNS, PRIORITY_LABEL } from "@/constants/task";
import type { Priority, TaskStatus } from "@/types";

export type BoardCard = {
  id: string;
  key: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  assignee: string;
  labels: string[];
  description?: string;
  updatedAt: string;
  commentCount: number;
  organizationName?: string;
};

const columnDot: Record<TaskStatus, string> = {
  backlog: "bg-slate-400",
  todo: "bg-primary-500",
  in_progress: "bg-amber-500",
  in_review: "bg-violet-500",
  done: "bg-emerald-500",
};

const priorityClass: Record<Priority, string> = {
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  medium: "bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300",
  high: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  urgent: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};

type BoardSort = "updated" | "name";

function compareCards(sort: BoardSort) {
  return (a: BoardCard, b: BoardCard) => {
    if (sort === "name") {
      const byTitle = a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true });
      if (byTitle !== 0) return byTitle;
      return a.key.localeCompare(b.key, undefined, { numeric: true });
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  };
}

type KanbanBoardProps = {
  tasks: BoardCard[];
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onToggleMany?: (ids: string[], selected: boolean) => void;
  onOpen: (task: BoardCard) => void;
  onCreate: (status: TaskStatus) => void;
  onMove: (id: string, status: TaskStatus) => Promise<unknown>;
};

export default function KanbanBoard({
  tasks,
  selectedIds = [],
  onToggleSelect,
  onToggleMany,
  onOpen,
  onCreate,
  onMove,
}: KanbanBoardProps) {
  const [over, setOver] = useState<TaskStatus | null>(null);
  const [columnSort, setColumnSort] = useState<Partial<Record<TaskStatus, BoardSort>>>({});
  const blockClick = useRef(false);

  return (
    <div className="board-scroll flex min-h-0 flex-1 gap-4 overflow-x-auto pb-2">
      {COLUMNS.map((column) => {
        const cards = tasks.filter((task) => task.status === column.id).sort(compareCards(columnSort[column.id] ?? "updated"));
        const allSelected = cards.length > 0 && cards.every((task) => selectedIds.includes(task.id));
        return (
          <section
            key={column.id}
            className={`flex h-full min-h-0 w-72 shrink-0 flex-col rounded-xl border bg-gray-100/80 dark:bg-gray-900/60 ${
              over === column.id
                ? "border-primary-400 dark:border-primary-500"
                : "border-gray-200 dark:border-gray-800"
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setOver(column.id);
            }}
            onDragLeave={(event) => {
              const next = event.relatedTarget;
              if (next instanceof Node && event.currentTarget.contains(next)) return;
              setOver((current) => (current === column.id ? null : current));
            }}
            onDrop={(event) => {
              event.preventDefault();
              const id = event.dataTransfer.getData("text/plain");
              setOver(null);
              if (id) {
                void onMove(id, column.id).catch((err: unknown) => {
                  toast.error(typeof err === "string" ? err : "Could not move the task");
                });
              }
            }}
          >
            <header className="flex flex-wrap items-center justify-between gap-2 px-3 py-3">
              <div className="flex min-w-0 items-center gap-2">
                {onToggleMany ? (
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) => onToggleMany(cards.map((task) => task.id), event.target.checked)}
                    aria-label={`Select all in ${column.title}`}
                    className="h-4 w-4 accent-primary-600"
                  />
                ) : null}
                <span className={`h-2.5 w-2.5 rounded-full ${columnDot[column.id]}`} />
                <h2 className="truncate text-sm font-semibold text-gray-900 dark:text-white">{column.title}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  {cards.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <select
                  aria-label={`Sort ${column.title}`}
                  value={columnSort[column.id] ?? "updated"}
                  onChange={(event) =>
                    setColumnSort((current) => ({ ...current, [column.id]: event.target.value as BoardSort }))
                  }
                  className="rounded-md border border-gray-200 bg-white px-1.5 py-1 text-[11px] text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >
                  <option value="updated">Updated</option>
                  <option value="name">Task name</option>
                </select>
                <button
                  type="button"
                  onClick={() => onCreate(column.id)}
                  className="rounded-md p-1 text-gray-500 hover:bg-white hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                  aria-label={`Add task to ${column.title}`}
                >
                  <HiOutlinePlus className="h-4 w-4" />
                </button>
              </div>
            </header>
            <div className="board-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3">
              {cards.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-300 px-3 py-6 text-center text-xs text-gray-400 dark:border-gray-700">
                  Drop a task here
                </p>
              ) : (
                cards.map((task) => (
                  <article
                    key={task.id}
                    draggable
                    onPointerDown={() => {
                      blockClick.current = false;
                    }}
                    onDragStart={(event) => {
                      blockClick.current = true;
                      event.dataTransfer.setData("text/plain", task.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setOver(null);
                    }}
                    onClick={() => {
                      if (blockClick.current) {
                        blockClick.current = false;
                        return;
                      }
                      onOpen(task);
                    }}
                    className="cursor-grab rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition hover:border-primary-300 active:cursor-grabbing dark:border-gray-800 dark:bg-gray-900 dark:hover:border-primary-700"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {onToggleSelect ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(task.id)}
                            aria-label={`Select ${task.title}`}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => onToggleSelect(task.id)}
                            className="h-4 w-4 shrink-0 accent-primary-600"
                          />
                        ) : null}
                        <span className="text-xs font-semibold text-gray-400">{task.key}</span>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${priorityClass[task.priority]}`}>
                        {PRIORITY_LABEL[task.priority]}
                      </span>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{task.title}</h3>
                    {task.description ? (
                      <RichText
                        markdown={task.description}
                        className="mt-1 line-clamp-2 text-xs font-normal text-gray-500 dark:text-gray-400"
                      />
                    ) : null}
                    {task.organizationName ? (
                      <p className="mt-1 text-xs text-gray-400">{task.organizationName}</p>
                    ) : null}
                    {task.labels.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {task.labels.slice(0, 3).map((label) => (
                          <span
                            key={label}
                            className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">{task.assignee}</p>
                      <span
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                        aria-label={`${task.commentCount} comments`}
                      >
                        <HiOutlineChatBubbleLeft className="h-3.5 w-3.5" />
                        {task.commentCount}
                      </span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
