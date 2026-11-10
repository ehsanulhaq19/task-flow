import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { STORAGE_KEYS } from "@/services/storage";
import { hydrateWorkspace } from "@/store/hydrate";
import type { ThemeMode, ThemeState } from "@/types";

const initialState: ThemeState = {
  mode: "light",
};

function persist(mode: ThemeMode) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.theme, mode);
}

const themeSlice = createSlice({
  name: "theme",
  initialState,
  reducers: {
    toggleTheme(state) {
      state.mode = state.mode === "light" ? "dark" : "light";
      persist(state.mode);
    },
    setTheme(state, action: PayloadAction<ThemeMode>) {
      state.mode = action.payload;
      persist(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder.addCase(hydrateWorkspace.fulfilled, (state, action) => {
      state.mode = action.payload.theme;
      persist(action.payload.theme);
    });
  },
});

export const { toggleTheme, setTheme } = themeSlice.actions;
export default themeSlice.reducer;
