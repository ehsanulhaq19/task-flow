import api from "@/services/api";
import type { ApiUser, TaskComment } from "@/services/employee";
import type { Priority, TaskStatus } from "@/types";

export type OrgRecord = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
};

export type AdminSummary = {
  organizations: number;
  users: number;
  employees: number;
  tasks: number;
  openTimers: number;
  screenshots: number;
};

export type AdminTask = {
  id: string;
  key: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assignee: string;
  assigneeUserId: string | null;
  organizationId: string;
  organizationName: string;
  commentCount: number;
  labels: string[];
  createdAt: string;
  updatedAt: string;
};

export type AdminTimeEntry = {
  id: string;
  userId: string;
  userName: string;
  organizationId: string;
  organizationName: string;
  taskId: string | null;
  taskKey: string | null;
  taskTitle: string | null;
  startedAt: string;
  endedAt: string | null;
  screenshotCount: number;
};

export type AdminScreenshot = {
  id: string;
  userId: string;
  userName: string;
  organizationId: string;
  organizationName: string;
  timeEntryId: string | null;
  taskKey: string | null;
  takenAt: string;
};

export async function fetchSummary() {
  const { data } = await api.get<AdminSummary>("/admin/summary");
  return data;
}

export async function fetchOrganizations() {
  const { data } = await api.get<OrgRecord[]>("/admin/organizations");
  return data;
}

export async function createOrganization(body: { name: string; slug?: string }) {
  const { data } = await api.post<OrgRecord>("/admin/organizations", body);
  return data;
}

export async function fetchUsers(organizationId?: string) {
  const { data } = await api.get<ApiUser[]>("/admin/users", {
    params: organizationId ? { organizationId } : undefined,
  });
  return data;
}

export async function createUser(body: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: "admin" | "employee";
  organizationId: string;
  jobTitle: string;
}) {
  const { data } = await api.post<ApiUser>("/admin/users", body);
  return data;
}

export async function updateUserLimits(userId: string, body: { minimumHours: number; maximumHours: number }) {
  const { data } = await api.patch<ApiUser>(`/admin/users/${userId}`, body);
  return data;
}

export async function fetchAdminTasks(organizationId?: string) {
  const { data } = await api.get<AdminTask[]>("/admin/tasks", {
    params: organizationId ? { organizationId } : undefined,
  });
  return data;
}

export async function moveAdminTask(id: string, status: TaskStatus) {
  const { data } = await api.patch<AdminTask>(`/admin/tasks/${id}`, { status });
  return data;
}

export async function saveAdminTask(
  id: string,
  body: {
    assigneeUserId: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: Priority;
    labels: string[];
  },
) {
  const { data } = await api.put<AdminTask>(`/admin/tasks/${id}`, body);
  return data;
}

export async function deleteAdminTask(id: string) {
  await api.delete(`/admin/tasks/${id}`);
}

export async function deleteAdminTasks(ids: string[]) {
  const { data } = await api.post<{ deleted: number }>("/admin/tasks/bulk-delete", { ids });
  return data;
}

export async function fetchAdminComments(taskId: string) {
  const { data } = await api.get<TaskComment[]>(`/admin/tasks/${taskId}/comments`);
  return data;
}

export async function addAdminComment(taskId: string, body: string) {
  const { data } = await api.post<TaskComment>(`/admin/tasks/${taskId}/comments`, { body });
  return data;
}

export async function createAdminTask(body: {
  organizationId: string;
  assigneeUserId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  labels: string[];
}) {
  const { data } = await api.post<AdminTask>("/admin/tasks", body);
  return data;
}

export type TaskImportError = {
  row: number;
  message: string;
};

export type TaskImportResult = {
  created: AdminTask[];
  errors: TaskImportError[];
};

export async function importAdminTasks(
  file: File,
  organizationId: string,
  onProgress: (percent: number) => void,
) {
  const body = new FormData();
  body.append("file", file);
  if (organizationId) body.append("organizationId", organizationId);
  const { data } = await api.post<TaskImportResult>("/admin/tasks/import", body, {
    onUploadProgress: (event) => {
      if (!event.total) return;
      onProgress(Math.min(90, Math.round((event.loaded / event.total) * 90)));
    },
  });
  onProgress(100);
  return data;
}

export type TimeLogPoint = {
  label: string;
  full: string;
  hours: number;
  minimumHours: number;
  maximumHours: number;
};

export type TimeLogSeries = {
  userId: string;
  userName: string;
  points: TimeLogPoint[];
};

export type TimeLogPage = {
  items: AdminTimeEntry[];
  total: number;
  page: number;
  pageSize: number;
  range: "daily" | "weekly" | "monthly";
  series: TimeLogSeries[];
};

export async function fetchTimeEntries(filters: {
  organizationId?: string;
  userId?: string;
  range: "daily" | "weekly" | "monthly";
  page: number;
  pageSize: number;
}) {
  const { data } = await api.get<TimeLogPage>("/admin/time-entries", { params: filters });
  return data;
}

export async function fetchTimeEntryScreenshots(timeEntryId: string) {
  const { data } = await api.get<AdminScreenshot[]>(`/admin/time-entries/${timeEntryId}/screenshots`);
  return data;
}

export async function fetchScreenshots(filters: { organizationId?: string; userId?: string }) {
  const { data } = await api.get<AdminScreenshot[]>("/admin/screenshots", { params: filters });
  return data;
}

export async function fetchScreenshotBlob(id: string) {
  const { data } = await api.get<Blob>(`/admin/screenshots/${id}/file`, { responseType: "blob" });
  return data;
}
