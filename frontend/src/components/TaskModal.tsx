"use client";

import { FormEvent, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { COLUMNS, PRIORITIES, PRIORITY_LABEL } from "@/constants/task";
import { fieldClass, labelClass, primaryButtonClass } from "@/constants/ui";
import { formatDateTime } from "@/lib/format";
import RichTextEditor, { RichText, visibleText } from "@/components/RichTextEditor";
import { addComment, listAssignees, listComments, type AssigneeOption, type TaskComment } from "@/services/employee";
import { apiError } from "@/services/api";
import { addTask, deleteTask, incrementCommentCount, updateTask } from "@/store/slices/taskSlice";
import { useAppDispatch } from "@/store/store";
import type { Priority, Task, TaskStatus } from "@/types";

type TaskDraft = {
  id?: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assignee: string;
  assigneeUserId: string;
  labels: string;
};

type TaskModalProps = {
  draft: TaskDraft;
  onClose: () => void;
};

export default function TaskModal({ draft, onClose }: TaskModalProps) {
  const dispatch = useAppDispatch();
  const [form, setForm] = useState(draft);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [people, setPeople] = useState<AssigneeOption[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [commentKey, setCommentKey] = useState(0);
  const [posting, setPosting] = useState(false);
  const editing = Boolean(draft.id);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    listAssignees()
      .then((rows) => {
        if (cancelled) return;
        const known = rows.some((person) => person.id === draft.assigneeUserId);
        if (draft.assigneeUserId && !known && draft.assignee) {
          const [firstName, ...rest] = draft.assignee.split(" ");
          setPeople([{ id: draft.assigneeUserId, firstName, lastName: rest.join(" ") }, ...rows]);
          return;
        }
        setPeople(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(apiError(err, "Could not load people"));
      });
    return () => {
      cancelled = true;
    };
  }, [draft.assignee, draft.assigneeUserId]);

  useEffect(() => {
    if (!draft.id) return;
    let cancelled = false;
    listComments(draft.id)
      .then((rows) => {
        if (!cancelled) setComments(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(apiError(err, "Could not load comments"));
      });
    return () => {
      cancelled = true;
    };
  }, [draft.id]);

  const set = (patch: Partial<TaskDraft>) => setForm((current) => ({ ...current, ...patch }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) {
      toast.error("Add a title");
      return;
    }
    const labels = form.labels
      .split(",")
      .map((label) => label.trim())
      .filter(Boolean)
      .slice(0, 4);
    if (!form.assigneeUserId) {
      toast.error("Choose an assignee");
      return;
    }
    const input = {
      title,
      description: form.description.trim(),
      status: form.status,
      priority: form.priority,
      assigneeUserId: form.assigneeUserId,
      labels,
    };

    try {
      if (editing && draft.id) {
        await dispatch(updateTask({ id: draft.id, ...input })).unwrap();
        toast.success("Task updated");
      } else {
        await dispatch(addTask(input)).unwrap();
        toast.success("Task created");
      }
      onClose();
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Could not save the task");
    }
  };

  const handleComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.id) return;
    if (!visibleText(commentBody)) {
      toast.error("Write a comment");
      return;
    }
    setPosting(true);
    try {
      const created = await addComment(draft.id, commentBody);
      dispatch(incrementCommentCount(draft.id));
      setComments((current) => [...current, created]);
      setCommentBody("");
      setCommentKey((current) => current + 1);
    } catch (err) {
      toast.error(apiError(err, "Could not add the comment"));
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async () => {
    if (!draft.id) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await dispatch(deleteTask(draft.id)).unwrap();
      toast.success("Task deleted");
      onClose();
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Could not delete the task");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close dialog" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 id="task-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white">
          {editing ? "Edit task" : "New task"}
        </h2>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className={labelClass} htmlFor="task-title">
              Title
            </label>
            <input
              id="task-title"
              className={fieldClass}
              value={form.title}
              onChange={(event) => set({ title: event.target.value })}
              placeholder="What needs to happen?"
              autoFocus
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="task-description">
              Description
            </label>
            <RichTextEditor
              id="task-description"
              value={form.description}
              onChange={(description) => set({ description })}
              placeholder="Add context for the person picking this up"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="task-status">
                Status
              </label>
              <select
                id="task-status"
                className={fieldClass}
                value={form.status}
                onChange={(event) => set({ status: event.target.value as TaskStatus })}
              >
                {COLUMNS.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="task-priority">
                Priority
              </label>
              <select
                id="task-priority"
                className={fieldClass}
                value={form.priority}
                onChange={(event) => set({ priority: event.target.value as Priority })}
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_LABEL[priority]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="task-assignee">
              Assignee
            </label>
            <select
              id="task-assignee"
              required
              className={fieldClass}
              value={form.assigneeUserId}
              onChange={(event) => set({ assigneeUserId: event.target.value })}
            >
              <option value="">Choose a person</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.firstName} {person.lastName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="task-labels">
              Labels
            </label>
            <input
              id="task-labels"
              className={fieldClass}
              value={form.labels}
              onChange={(event) => set({ labels: event.target.value })}
              placeholder="frontend, bug"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {editing ? (
              <button
                type="button"
                onClick={handleDelete}
                className="text-sm font-medium text-rose-600 hover:text-rose-500"
              >
                {confirmDelete ? "Confirm delete" : "Delete"}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button type="submit" className={primaryButtonClass}>
                {editing ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </form>
        <section className="mt-6 border-t border-gray-100 pt-5 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Comments</h3>
          {editing ? (
            <>
              <div className="mt-3 space-y-3">
                {comments.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No comments yet.</p>
                ) : (
                  comments.map((comment) => (
                    <article key={comment.id} className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/70">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-medium text-gray-700 dark:text-gray-200">{comment.authorName}</span>
                        {" · "}
                        {formatDateTime(comment.createdAt)}
                      </p>
                      <RichText markdown={comment.body} />
                    </article>
                  ))
                )}
              </div>
              <form onSubmit={handleComment} className="mt-3 space-y-3">
                <RichTextEditor
                  key={commentKey}
                  id="task-comment"
                  value={commentBody}
                  onChange={setCommentBody}
                  placeholder="Write a comment"
                />
                <button type="submit" className={primaryButtonClass} disabled={posting}>
                  {posting ? "Posting..." : "Add comment"}
                </button>
              </form>
            </>
          ) : (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Save the task before adding comments.</p>
          )}
        </section>
      </div>
    </div>
  );
}

export function draftFromTask(task: Task): TaskDraft {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assignee: task.assignee,
    assigneeUserId: task.assigneeUserId ?? "",
    labels: task.labels.join(", "),
  };
}

export function emptyDraft(status: TaskStatus, assigneeUserId: string): TaskDraft {
  return {
    title: "",
    description: "",
    status,
    priority: "medium",
    assignee: "",
    assigneeUserId,
    labels: "",
  };
}
