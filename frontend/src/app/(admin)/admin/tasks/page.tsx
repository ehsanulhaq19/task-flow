"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { HiOutlineArrowDownTray, HiOutlineArrowUpTray, HiOutlineDocumentText } from "react-icons/hi2";
import toast from "react-hot-toast";
import { AdminIntro } from "@/components/admin/AdminShell";
import AdminTaskModal from "@/components/admin/AdminTaskModal";
import KanbanBoard, { type BoardCard } from "@/components/KanbanBoard";
import RichTextEditor from "@/components/RichTextEditor";
import { COLUMNS, PRIORITIES, PRIORITY_LABEL } from "@/constants/task";
import { fieldClass, labelClass, primaryButtonClass } from "@/constants/ui";
import { apiError } from "@/services/api";
import type { ApiUser } from "@/services/employee";
import {
  createAdminTask,
  deleteAdminTasks,
  fetchAdminTasks,
  fetchOrganizations,
  fetchUsers,
  importAdminTasks,
  moveAdminTask,
  type AdminTask,
  type OrgRecord,
  type TaskImportResult,
} from "@/services/admin";
import type { Priority, TaskStatus } from "@/types";

export default function AdminTasksPage() {
  const [organizations, setOrganizations] = useState<OrgRecord[]>([]);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draftStatus, setDraftStatus] = useState<TaskStatus | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchOrganizations(), fetchUsers(), fetchAdminTasks()])
      .then(([orgs, people, cards]) => {
        if (cancelled) return;
        setOrganizations(orgs);
        setUsers(people);
        setTasks(cards);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(apiError(err, "Could not load tasks"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = organizationId ? tasks.filter((task) => task.organizationId === organizationId) : tasks;

  useEffect(() => {
    const shown = organizationId ? tasks.filter((task) => task.organizationId === organizationId) : tasks;
    const visibleIds = new Set(shown.map((task) => task.id));
    setSelectedIds((current) => {
      const next = current.filter((id) => visibleIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [organizationId, tasks]);

  const moveCard = async (id: string, status: TaskStatus) => {
    const previous = tasks;
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, status } : task)));
    try {
      const updated = await moveAdminTask(id, status);
      setTasks((current) => current.map((task) => (task.id === id ? updated : task)));
    } catch (err) {
      setTasks(previous);
      throw apiError(err, "Could not move the task");
    }
  };

  const selectedOrg = organizations.find((org) => org.id === organizationId);
  const openTask = tasks.find((task) => task.id === openTaskId) ?? null;

  const openCard = (card: BoardCard) => {
    if (tasks.some((task) => task.id === card.id)) setOpenTaskId(card.id);
  };

  const toggleSelected = (id: string) => {
    setConfirmBulk(false);
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const toggleMany = (ids: string[], selected: boolean) => {
    setConfirmBulk(false);
    setSelectedIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => {
        if (selected) next.add(id);
        else next.delete(id);
      });
      return Array.from(next);
    });
  };

  const deleteSelected = async () => {
    if (!confirmBulk) {
      setConfirmBulk(true);
      return;
    }
    setDeleting(true);
    try {
      const result = await deleteAdminTasks(selectedIds);
      const removed = new Set(selectedIds);
      setTasks((current) => current.filter((task) => !removed.has(task.id)));
      setSelectedIds([]);
      setConfirmBulk(false);
      if (openTaskId && removed.has(openTaskId)) setOpenTaskId(null);
      toast.success(`Deleted ${result.deleted} ${result.deleted === 1 ? "task" : "tasks"}`);
    } catch (err) {
      toast.error(apiError(err, "Could not delete the tasks"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="absolute inset-0 flex min-h-0 flex-col overflow-hidden p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <AdminIntro
          title="Tasks"
          text="Drag a card to change its column. Import a CSV to add tasks to Backlog."
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            className={`${fieldClass} sm:w-56`}
            value={organizationId}
            aria-label="Organization"
            onChange={(event) => setOrganizationId(event.target.value)}
          >
            <option value="">All organizations</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setImportOpen(true)} className={primaryButtonClass}>
            <HiOutlineArrowUpTray className="h-4 w-4" />
            Import
          </button>
        </div>
      </div>
      {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}
      {selectedIds.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {selectedIds.length} {selectedIds.length === 1 ? "task" : "tasks"} selected
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedIds([]);
                setConfirmBulk(false);
              }}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => void deleteSelected()}
              disabled={deleting}
              className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {deleting ? "Deleting..." : confirmBulk ? "Confirm delete" : "Delete"}
            </button>
          </div>
        </div>
      ) : null}
      {loading ? (
        <p className="text-sm text-gray-500">Loading tasks...</p>
      ) : (
        <KanbanBoard
          tasks={visible}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelected}
          onToggleMany={toggleMany}
          onOpen={openCard}
          onCreate={setDraftStatus}
          onMove={moveCard}
        />
      )}
      {draftStatus ? (
        <CreateTaskModal
          status={draftStatus}
          organizations={organizations}
          users={users}
          organizationId={organizationId}
          onClose={() => setDraftStatus(null)}
          onCreated={(task) => setTasks((current) => [task, ...current])}
        />
      ) : null}
      {openTask ? (
        <AdminTaskModal
          task={openTask}
          users={users}
          onClose={() => setOpenTaskId(null)}
          onSaved={(task) => setTasks((current) => current.map((item) => (item.id === task.id ? task : item)))}
          onDeleted={(id) => setTasks((current) => current.filter((item) => item.id !== id))}
          onComment={(id) =>
            setTasks((current) =>
              current.map((item) => (item.id === id ? { ...item, commentCount: item.commentCount + 1 } : item)),
            )
          }
        />
      ) : null}
      {importOpen ? (
        <ImportTasksModal
          users={users}
          organizationId={organizationId}
          organizationName={selectedOrg?.name ?? ""}
          onClose={() => setImportOpen(false)}
          onImported={(created) => setTasks((current) => [...created, ...current])}
        />
      ) : null}
    </div>
  );
}

function CreateTaskModal({
  status,
  organizations,
  users,
  organizationId,
  onClose,
  onCreated,
}: {
  status: TaskStatus;
  organizations: OrgRecord[];
  users: ApiUser[];
  organizationId: string;
  onClose: () => void;
  onCreated: (task: AdminTask) => void;
}) {
  const [orgId, setOrgId] = useState(organizationId || organizations[0]?.id || "");
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [saving, setSaving] = useState(false);
  const people = useMemo(() => users.filter((user) => user.organizationId === orgId), [users, orgId]);
  const column = COLUMNS.find((item) => item.id === status)?.title ?? "To Do";

  useEffect(() => {
    setAssigneeUserId(people[0]?.id ?? "");
  }, [people]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!assigneeUserId) {
      toast.error("Choose someone in this organization");
      return;
    }
    setSaving(true);
    try {
      const created = await createAdminTask({
        organizationId: orgId,
        assigneeUserId,
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        labels: [],
      });
      onCreated(created);
      toast.success(`${created.key} assigned to ${created.assignee}`);
      onClose();
    } catch (err) {
      toast.error(apiError(err, "Could not create the task"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close dialog" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-lg space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New task in {column}</h2>
        <div>
          <label className={labelClass} htmlFor="admin-task-title">
            Title
          </label>
          <input id="admin-task-title" required className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
        </div>
        <div>
          <label className={labelClass} htmlFor="admin-task-description">
            Description
          </label>
          <RichTextEditor
            id="admin-task-description"
            value={description}
            onChange={setDescription}
            placeholder="Add context for the person picking this up"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="admin-task-org">
              Organization
            </label>
            <select
              id="admin-task-org"
              required
              className={fieldClass}
              value={orgId}
              onChange={(event) => setOrgId(event.target.value)}
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="admin-task-assignee">
              Assign to
            </label>
            <select
              id="admin-task-assignee"
              required
              className={fieldClass}
              value={assigneeUserId}
              onChange={(event) => setAssigneeUserId(event.target.value)}
            >
              {people.length === 0 ? <option value="">No people in this organization</option> : null}
              {people.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="admin-task-priority">
            Priority
          </label>
          <select id="admin-task-priority" className={fieldClass} value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
            {PRIORITIES.map((item) => (
              <option key={item} value={item}>
                {PRIORITY_LABEL[item]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
            Cancel
          </button>
          <button type="submit" className={primaryButtonClass} disabled={saving || !assigneeUserId}>
            {saving ? "Assigning..." : "Create and assign"}
          </button>
        </div>
      </form>
    </div>
  );
}

function csvCell(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function downloadMockCsv(users: ApiUser[], organizationId: string) {
  const pool = users.filter((user) => !organizationId || user.organizationId === organizationId);
  const first = pool[0]?.email ?? "alex@example.com";
  const second = pool[1]?.email ?? first;
  const rows = [
    ["task name", "description", "assignee email", "priority"],
    ["Prepare onboarding checklist", "List accounts, tools, and the first-week plan", first, "medium"],
    ["Review weekly hours", "Confirm logged time before the daily email", second, "high"],
    ["Update the release notes", "Write what shipped this week", first, "urgent"],
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "taskflow-tasks.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ImportTasksModal({
  users,
  organizationId,
  organizationName,
  onClose,
  onImported,
}: {
  users: ApiUser[];
  organizationId: string;
  organizationName: string;
  onClose: () => void;
  onImported: (tasks: AdminTask[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<TaskImportResult | null>(null);
  const [failure, setFailure] = useState("");

  const chooseFile = (next: File | null) => {
    setResult(null);
    setFailure("");
    setProgress(0);
    if (!next) {
      setFile(null);
      return;
    }
    if (!next.name.toLowerCase().endsWith(".csv")) {
      toast.error("Choose a .csv file");
      return;
    }
    if (next.size > 1_048_576) {
      toast.error("CSV file must be 1 MB or smaller");
      return;
    }
    setFile(next);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setFailure("");
    setResult(null);
    setProgress(8);
    try {
      const imported = await importAdminTasks(file, organizationId, setProgress);
      setProgress(100);
      setResult(imported);
      if (imported.created.length > 0) onImported(imported.created);
      const importedLabel = `${imported.created.length} ${imported.created.length === 1 ? "task" : "tasks"}`;
      if (imported.created.length > 0 && imported.errors.length === 0) {
        toast.success(`Imported ${importedLabel}`);
      } else if (imported.created.length > 0) {
        const skippedLabel = `${imported.errors.length} ${imported.errors.length === 1 ? "row needs" : "rows need"} a fix`;
        toast.success(`Imported ${importedLabel}. ${skippedLabel}.`);
      } else {
        toast.error("No tasks were imported");
      }
    } catch (err) {
      setProgress(0);
      setFailure(apiError(err, "Could not import the CSV"));
    } finally {
      setImporting(false);
    }
  };

  const progressLabel = importing ? (progress >= 90 ? "Saving tasks..." : "Uploading CSV...") : result ? "Import complete" : "Waiting to import";

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close dialog"
        onClick={() => {
          if (!importing) onClose();
        }}
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
        <div className="space-y-4 overflow-y-auto p-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Import tasks</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {organizationName
                ? `Assignee emails must belong to ${organizationName}. Tasks are added to Backlog.`
                : "Each task is added to Backlog in the assignee's organization."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => downloadMockCsv(users, organizationId)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <HiOutlineArrowDownTray className="h-4 w-4" />
            Download sample CSV
          </button>
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(event) => {
              const next = event.relatedTarget;
              if (next instanceof Node && event.currentTarget.contains(next)) return;
              setDragOver(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              if (!importing) chooseFile(event.dataTransfer.files[0] ?? null);
            }}
            className={`rounded-xl border border-dashed px-4 py-8 text-center ${
              dragOver
                ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                : "border-gray-300 dark:border-gray-700"
            }`}
          >
            <HiOutlineDocumentText className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-3 text-sm font-medium text-gray-900 dark:text-white">
              {file ? file.name : "Drop a CSV here"}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {file ? `${Math.max(1, Math.round(file.size / 1024))} KB` : "Columns: task name, description, assignee email, priority"}
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={importing}
              className="mt-4 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {file ? "Choose another file" : "Choose CSV"}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                chooseFile(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{progressLabel}</span>
              <span>{progress}%</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label="Import progress"
            >
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  result && result.errors.length > 0 && result.created.length === 0 ? "bg-rose-500" : "bg-primary-600"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          {failure ? <p className="text-sm text-rose-600">{failure}</p> : null}
          {result ? (
            <div className="space-y-2 text-sm">
              <p className="font-medium text-gray-900 dark:text-white">
                Imported {result.created.length} {result.created.length === 1 ? "task" : "tasks"}
                {result.errors.length > 0 ? `. ${result.errors.length} skipped.` : "."}
              </p>
              {result.errors.length > 0 ? (
                <ul className="max-h-36 space-y-1 overflow-y-auto text-rose-600">
                  {result.errors.map((item) => (
                    <li key={`${item.row}-${item.message}`}>
                      Row {item.row}: {item.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {result ? "Close" : "Cancel"}
          </button>
          <button type="button" onClick={() => void handleImport()} className={primaryButtonClass} disabled={importing || !file || result !== null}>
            {importing ? "Importing..." : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
