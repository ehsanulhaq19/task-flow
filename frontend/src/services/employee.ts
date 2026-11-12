import api from "@/services/api";
import type { Task, TaskStatus, TimeSession } from "@/types";

export type ApiUser = {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string;
  systemRole: "admin" | "employee";
  jobTitle: string;
  organizationName: string;
  dailyTargetHours: number;
  configurationData?: {
    minimumHours?: number;
    maximumHours?: number;
  };
};

export type TaskInput = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: Task["priority"];
  assigneeUserId: string;
  labels: string[];
};

export type AssigneeOption = {
  id: string;
  firstName: string;
  lastName: string;
};

export type TaskComment = {
  id: string;
  taskId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export function mapUser(raw: ApiUser) {
  return {
    id: raw.id,
    organizationId: raw.organizationId,
    firstName: raw.firstName,
    lastName: raw.lastName,
    email: raw.email,
    role: raw.jobTitle,
    systemRole: raw.systemRole,
    organizationName: raw.organizationName,
    dailyTargetHours: raw.dailyTargetHours,
    configurationData: {
      minimumHours: raw.configurationData?.minimumHours ?? raw.dailyTargetHours,
      maximumHours: Math.max(
        raw.configurationData?.minimumHours ?? raw.dailyTargetHours,
        raw.configurationData?.maximumHours ?? raw.dailyTargetHours,
      ),
    },
  };
}

export async function login(email: string, password: string) {
  const { data } = await api.post<{ accessToken: string }>("/auth/login", { email, password });
  return data.accessToken;
}

export async function currentUser() {
  const { data } = await api.get<ApiUser>("/auth/me");
  return mapUser(data);
}

export async function saveProfile(body: {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  dailyTargetHours: number;
}) {
  const { data } = await api.put<ApiUser>("/auth/me", body);
  return mapUser(data);
}

export async function listAssignees() {
  const { data } = await api.get<AssigneeOption[]>("/tasks/assignees");
  return data;
}

export async function listComments(taskId: string) {
  const { data } = await api.get<TaskComment[]>(`/tasks/${taskId}/comments`);
  return data;
}

export async function addComment(taskId: string, body: string) {
  const { data } = await api.post<TaskComment>(`/tasks/${taskId}/comments`, { body });
  return data;
}

export async function listTasks() {
  const { data } = await api.get<Task[]>("/tasks");
  return data;
}

export async function createTask(input: TaskInput) {
  const { data } = await api.post<Task>("/tasks", input);
  return data;
}

export async function saveTask(id: string, input: TaskInput) {
  const { data } = await api.put<Task>(`/tasks/${id}`, input);
  return data;
}

export async function moveTaskStatus(id: string, status: TaskStatus) {
  const { data } = await api.patch<Task>(`/tasks/${id}`, { status });
  return data;
}

export async function removeTask(id: string) {
  await api.delete(`/tasks/${id}`);
}

export async function listSessions() {
  const { data } = await api.get<TimeSession[]>("/time/sessions");
  return data;
}

export async function startSession(taskId: string) {
  const { data } = await api.post<TimeSession[]>("/time/start", { taskId });
  return data;
}

export async function stopSession() {
  const { data } = await api.post<TimeSession[]>("/time/stop");
  return data;
}
