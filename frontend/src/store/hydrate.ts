import { createAsyncThunk } from "@reduxjs/toolkit";
import Cookies from "js-cookie";
import { currentUser, listSessions, listTasks } from "@/services/employee";
import { AUTH_COOKIE, STORAGE_KEYS } from "@/services/storage";
import type { HydratePayload, ThemeMode } from "@/types";

function readTheme(): ThemeMode {
  const storedTheme = localStorage.getItem(STORAGE_KEYS.theme);
  if (storedTheme === "dark" || storedTheme === "light") return storedTheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function signedOut(theme: ThemeMode): HydratePayload {
  return {
    tasks: [],
    sessions: [],
    settings: { dailyTargetHours: 8 },
    theme,
    token: null,
    user: null,
  };
}

export const hydrateWorkspace = createAsyncThunk<HydratePayload>("workspace/hydrate", async () => {
  const theme = readTheme();
  const token = Cookies.get(AUTH_COOKIE) ?? null;
  if (!token) return signedOut(theme);
  try {
    const user = await currentUser();
    const [tasks, sessions] =
      user.systemRole === "employee" ? await Promise.all([listTasks(), listSessions()]) : [[], []];
    return {
      tasks,
      sessions,
      settings: { dailyTargetHours: user.dailyTargetHours },
      theme,
      token,
      user,
    };
  } catch {
    Cookies.remove(AUTH_COOKIE);
    return signedOut(theme);
  }
});
