export type TaskStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "done";

export type Priority = "low" | "medium" | "high" | "urgent";

export type ThemeMode = "light" | "dark";

export interface User {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  systemRole: "admin" | "employee";
  organizationName: string;
  dailyTargetHours: number;
}

export interface Task {
  id: string;
  key: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assignee: string;
  assigneeUserId: string | null;
  commentCount: number;
  labels: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TimeSession {
  id: string;
  taskId: string | null;
  startedAt: string;
  endedAt: string | null;
}

export interface SettingsPrefs {
  dailyTargetHours: number;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  hydrated: boolean;
}

export interface ThemeState {
  mode: ThemeMode;
}

export interface TaskState {
  tasks: Task[];
}

export interface TimeState {
  sessions: TimeSession[];
}

export interface SettingsState {
  dailyTargetHours: number;
}

export interface HydratePayload {
  tasks: Task[];
  sessions: TimeSession[];
  settings: SettingsPrefs;
  theme: ThemeMode;
  token: string | null;
  user: User | null;
}
