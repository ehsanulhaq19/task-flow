import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { apiError } from "@/services/api";
import { createTask, moveTaskStatus, removeTask, saveTask, type TaskInput } from "@/services/employee";
import { hydrateWorkspace } from "@/store/hydrate";
import { loginUser, logoutUser } from "@/store/slices/authSlice";
import type { Task, TaskState, TaskStatus } from "@/types";

const initialState: TaskState = {
  tasks: [],
};

export const addTask = createAsyncThunk<Task, TaskInput>("tasks/add", async (input, { rejectWithValue }) => {
  try {
    return await createTask(input);
  } catch (error) {
    return rejectWithValue(apiError(error, "Could not create the task"));
  }
});

export const updateTask = createAsyncThunk<Task, TaskInput & { id: string }>(
  "tasks/update",
  async ({ id, ...input }, { rejectWithValue }) => {
    try {
      return await saveTask(id, input);
    } catch (error) {
      return rejectWithValue(apiError(error, "Could not update the task"));
    }
  }
);

export const deleteTask = createAsyncThunk<string, string>("tasks/delete", async (id, { rejectWithValue }) => {
  try {
    await removeTask(id);
    return id;
  } catch (error) {
    return rejectWithValue(apiError(error, "Could not delete the task"));
  }
});

export const moveTask = createAsyncThunk<Task | null, { id: string; status: TaskStatus }>(
  "tasks/move",
  async ({ id, status }, { getState, rejectWithValue }) => {
    const state = getState() as { tasks: TaskState };
    const current = state.tasks.tasks.find((task) => task.id === id);
    if (current?.status === status) return current;
    try {
      return await moveTaskStatus(id, status);
    } catch (error) {
      return rejectWithValue(apiError(error, "Could not move the task"));
    }
  }
);

const taskSlice = createSlice({
  name: "tasks",
  initialState,
  reducers: {
    incrementCommentCount(state, action: PayloadAction<string>) {
      const task = state.tasks.find((item) => item.id === action.payload);
      if (task) task.commentCount = (task.commentCount ?? 0) + 1;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(hydrateWorkspace.fulfilled, (state, action) => {
        state.tasks = action.payload.tasks;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.tasks = action.payload.tasks;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.tasks = [];
      })
      .addCase(addTask.fulfilled, (state, action) => {
        state.tasks.unshift(action.payload);
      })
      .addCase(updateTask.fulfilled, (state, action) => {
        const index = state.tasks.findIndex((task) => task.id === action.payload.id);
        if (index === -1) state.tasks.unshift(action.payload);
        else state.tasks[index] = action.payload;
      })
      .addCase(deleteTask.fulfilled, (state, action) => {
        state.tasks = state.tasks.filter((task) => task.id !== action.payload);
      })
      .addCase(moveTask.fulfilled, (state, action) => {
        const task = action.payload;
        if (!task) return;
        const index = state.tasks.findIndex((item) => item.id === task.id);
        if (index === -1) return;
        state.tasks[index] = task;
      });
  },
});

export const { incrementCommentCount } = taskSlice.actions;

export default taskSlice.reducer;
