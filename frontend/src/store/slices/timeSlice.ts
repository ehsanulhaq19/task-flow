import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { apiError } from "@/services/api";
import { startSession, stopSession } from "@/services/employee";
import { hydrateWorkspace } from "@/store/hydrate";
import { loginUser, logoutUser } from "@/store/slices/authSlice";
import type { TimeSession, TimeState } from "@/types";

const initialState: TimeState = {
  sessions: [],
};

export const startTimer = createAsyncThunk<TimeSession[], { taskId: string }>(
  "time/start",
  async ({ taskId }, { rejectWithValue }) => {
    try {
      return await startSession(taskId);
    } catch (error) {
      return rejectWithValue(apiError(error, "Could not start the timer"));
    }
  }
);

export const stopTimer = createAsyncThunk<TimeSession[]>("time/stop", async (_, { rejectWithValue }) => {
  try {
    return await stopSession();
  } catch (error) {
    return rejectWithValue(apiError(error, "Could not stop the timer"));
  }
});

const timeSlice = createSlice({
  name: "time",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(hydrateWorkspace.fulfilled, (state, action) => {
        state.sessions = action.payload.sessions;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.sessions = action.payload.sessions;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.sessions = [];
      })
      .addCase(startTimer.fulfilled, (state, action) => {
        state.sessions = action.payload;
      })
      .addCase(stopTimer.fulfilled, (state, action) => {
        state.sessions = action.payload;
      });
  },
});

export default timeSlice.reducer;
