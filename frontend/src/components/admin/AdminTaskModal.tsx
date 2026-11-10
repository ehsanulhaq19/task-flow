"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import RichTextEditor, { RichText, visibleText } from "@/components/RichTextEditor";
import { COLUMNS, PRIORITIES, PRIORITY_LABEL } from "@/constants/task";
import { fieldClass, labelClass, primaryButtonClass } from "@/constants/ui";
import { formatDateTime } from "@/lib/format";
import { apiError } from "@/services/api";
import {
  addAdminComment,
  deleteAdminTask,
  fetchAdminComments,
  saveAdminTask,
  type AdminTask,
} from "@/services/admin";
import type { ApiUser, TaskComment } from "@/services/employee";
import type { Priority, TaskStatus } from "@/types";

type AdminTaskModalProps = {
  task: AdminTask;
  users: ApiUser[];
  onClose: () => void;
  onSaved: (task: AdminTask) => void;
  onDeleted: (id: string) => void;
  onComment: (id: string) => void;
};

export default function AdminTaskModal({ task, users, onClose, onSaved, onDeleted, onComment }: AdminTaskModalProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [assigneeUserId, setAssigneeUserId] = useState(task.assigneeUserId ?? "");
  const [labels, setLabels] = useState(task.labels.join(", "));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [commentKey, setCommentKey] = useState(0);
  const [posting, setPosting] = useState(false);

  const people = useMemo(() => {
    const inOrg = users.filter((user) => user.organizationId === task.organizationId);
    if (task.assigneeUserId && !inOrg.some((user) => user.id === task.assigneeUserId)) {
      const [firstName, ...rest] = task.assignee.split(" ");
      return [
        {
          id: task.assigneeUserId,
          organizationId: task.organizationId,
          firstName: firstName || task.assignee,
          lastName: rest.join(" "),
          email: "",
          systemRole: "employee" as const,
          jobTitle: "",
          organizationName: task.organizationName,
          dailyTargetHours: 8,
        },
        ...inOrg,
      ];
    }
    return inOrg;
  }, [task, users]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    fetchAdminComments(task.id)
      .then((rows) => {
        if (!cancelled) setComments(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(apiError(err, "Could not load comments"));
      });
    return () => {
      cancelled = true;
    };
  }, [task.id]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) {
      toast.error("Add a title");
      return;
    }
    if (!assigneeUserId) {
      toast.error("Choose an assignee");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveAdminTask(task.id, {
        title: nextTitle,
        description: description.trim(),
        status,
        priority,
        assigneeUserId,
        labels: labels
          .split(",")
          .map((label) => label.trim())
          .filter(Boolean)
          .slice(0, 4),
      });
      onSaved(saved);
      toast.success("Task updated");
      onClose();
    } catch (err) {
      toast.error(apiError(err, "Could not save the task"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await deleteAdminTask(task.id);
      onDeleted(task.id);
      toast.success("Task deleted");
      onClose();
    } catch (err) {
      toast.error(apiError(err, "Could not delete the task"));
    }
  };

  const handleComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!visibleText(commentBody)) {
      toast.error("Write a comment");
      return;
    }
    setPosting(true);
    try {
      const created = await addAdminComment(task.id, commentBody);
      setComments((current) => [...current, created]);
      setCommentBody("");
      setCommentKey((current) => current + 1);
      onComment(task.id);
    } catch (err) {
      toast.error(apiError(err, "Could not add the comment"));
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close dialog" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-task-modal-title"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 id="admin-task-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white">
          {task.key}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{task.organizationName}</p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className={labelClass} htmlFor="admin-edit-title">
              Title
            </label>
            <input
              id="admin-edit-title"
              className={fieldClass}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="admin-edit-description">
              Description
            </label>
            <RichTextEditor
              id="admin-edit-description"
              value={description}
              onChange={setDescription}
              placeholder="Add context for the person picking this up"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="admin-edit-status">
                Status
              </label>
              <select
                id="admin-edit-status"
                className={fieldClass}
                value={status}
                onChange={(event) => setStatus(event.target.value as TaskStatus)}
              >
                {COLUMNS.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="admin-edit-priority">
                Priority
              </label>
              <select
                id="admin-edit-priority"
                className={fieldClass}
                value={priority}
                onChange={(event) => setPriority(event.target.value as Priority)}
              >
                {PRIORITIES.map((item) => (
                  <option key={item} value={item}>
                    {PRIORITY_LABEL[item]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="admin-edit-assignee">
              Assignee
            </label>
            <select
              id="admin-edit-assignee"
              required
              className={fieldClass}
              value={assigneeUserId}
              onChange={(event) => setAssigneeUserId(event.target.value)}
            >
              {people.length === 0 ? <option value="">No people in this organization</option> : null}
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.firstName} {person.lastName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="admin-edit-labels">
              Labels
            </label>
            <input
              id="admin-edit-labels"
              className={fieldClass}
              value={labels}
              onChange={(event) => setLabels(event.target.value)}
              placeholder="frontend, bug"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button type="button" onClick={() => void handleDelete()} className="text-sm font-medium text-rose-600 hover:text-rose-500">
              {confirmDelete ? "Confirm delete" : "Delete"}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button type="submit" className={primaryButtonClass} disabled={saving || !assigneeUserId}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </form>
        <section className="mt-6 border-t border-gray-100 pt-5 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Comments</h3>
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
          <form onSubmit={(event) => void handleComment(event)} className="mt-3 space-y-3">
            <RichTextEditor key={commentKey} id="admin-task-comment" value={commentBody} onChange={setCommentBody} placeholder="Write a comment" />
            <button type="submit" className={primaryButtonClass} disabled={posting}>
              {posting ? "Posting..." : "Add comment"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
