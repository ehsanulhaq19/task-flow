import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import Cookies from "js-cookie";
import { apiError } from "@/services/api";
import { currentUser, listSessions, listTasks, login, saveProfile } from "@/services/employee";
import { AUTH_COOKIE, STORAGE_KEYS } from "@/services/storage";
import { hydrateWorkspace } from "@/store/hydrate";
import type { AuthState, Task, TimeSession, User } from "@/types";

const initialState: AuthState = {
  user: null,
  token: null,
  loading: false,
  error: null,
  hydrated: false,
};

export const loginUser = createAsyncThunk<
  { token: string; user: User; tasks: Task[]; sessions: TimeSession[] },
  { email: string; password: string }
>("auth/login", async ({ email, password }, { rejectWithValue }) => {
  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return rejectWithValue("Enter a valid email address");
  }
  try {
    const token = await login(trimmed, password);
    Cookies.set(AUTH_COOKIE, token, {
      expires: 7,
      sameSite: "lax",
      secure: window.location.protocol === "https:",
    });
    const user = await currentUser();
    if (user.systemRole === "employee") {
      const [tasks, sessions] = await Promise.all([listTasks(), listSessions()]);
      return { token, user, tasks, sessions };
    }
    return { token, user, tasks: [], sessions: [] };
  } catch (error) {
    Cookies.remove(AUTH_COOKIE);
    return rejectWithValue(apiError(error, "Login failed"));
  }
});

export const logoutUser = createAsyncThunk("auth/logout", async () => {
  Cookies.remove(AUTH_COOKIE);
  localStorage.removeItem(STORAGE_KEYS.user);
});

export const updateProfile = createAsyncThunk<
  User,
  { firstName: string; lastName: string; email: string; jobTitle: string; dailyTargetHours: number }
>("auth/updateProfile", async (body, { rejectWithValue }) => {
  try {
    return await saveProfile(body);
  } catch (error) {
    return rejectWithValue(apiError(error, "Could not save settings"));
  }
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(hydrateWorkspace.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.hydrated = true;
        state.loading = false;
      })
      .addCase(hydrateWorkspace.rejected, (state) => {
        state.hydrated = true;
        state.loading = false;
      })
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.token = null;
        state.user = null;
        state.error = (action.payload as string) || "Login failed";
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.loading = false;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.user = action.payload;
      });
  },
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;
