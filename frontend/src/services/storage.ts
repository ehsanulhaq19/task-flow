export const AUTH_COOKIE = "taskflow_token";

export const STORAGE_KEYS = {
  tasks: "taskflow.tasks",
  sessions: "taskflow.sessions",
  settings: "taskflow.settings",
  user: "taskflow.user",
  theme: "taskflow.theme",
} as const;

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}
