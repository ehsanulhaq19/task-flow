import { createSlice } from "@reduxjs/toolkit";
import { hydrateWorkspace } from "@/store/hydrate";
import { loginUser, logoutUser, updateProfile } from "@/store/slices/authSlice";
import type { SettingsState } from "@/types";

const initialState: SettingsState = {
  dailyTargetHours: 8,
};

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(hydrateWorkspace.fulfilled, (state, action) => {
        state.dailyTargetHours = action.payload.settings.dailyTargetHours;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.dailyTargetHours = action.payload.user.dailyTargetHours;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.dailyTargetHours = 8;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.dailyTargetHours = action.payload.dailyTargetHours;
      });
  },
});

export default settingsSlice.reducer;
