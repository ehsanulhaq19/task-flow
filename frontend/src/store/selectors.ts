import type { RootState } from "@/store/store";

export const selectOpenSession = (state: RootState) =>
  state.time.sessions.find((session) => session.endedAt === null) ?? null;

export const selectCurrentTask = (state: RootState) => {
  const open = selectOpenSession(state);
  if (open?.taskId) {
    const linked = state.tasks.tasks.find((task) => task.id === open.taskId);
    if (linked) return linked;
  }
  const inProgress = state.tasks.tasks
    .filter((task) => task.status === "in_progress")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return inProgress[0] ?? null;
};
