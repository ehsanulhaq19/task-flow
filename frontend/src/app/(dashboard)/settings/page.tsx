"use client";

import { FormEvent, useState } from "react";
import toast from "react-hot-toast";
import { cardClass, fieldClass, labelClass, primaryButtonClass } from "@/constants/ui";
import { updateProfile } from "@/store/slices/authSlice";
import { setTheme } from "@/store/slices/themeSlice";
import { useAppDispatch, useAppSelector } from "@/store/store";
import type { ThemeMode } from "@/types";

export default function SettingsPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const mode = useAppSelector((state) => state.theme.mode);
  const dailyTargetHours = useAppSelector((state) => state.settings.dailyTargetHours);
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState(user?.role ?? "");
  const [target, setTarget] = useState(String(dailyTargetHours));
  const [saving, setSaving] = useState(false);

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const nextFirst = firstName.trim();
    const nextLast = lastName.trim();
    const nextEmail = email.trim().toLowerCase();
    if (!nextFirst || !nextLast) {
      toast.error("First and last name are required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      toast.error("Enter a valid email address");
      return;
    }
    const hours = Number(target);
    if (!Number.isFinite(hours) || hours < 1 || hours > 16) {
      toast.error("Daily target must be between 1 and 16 hours");
      return;
    }
    setSaving(true);
    try {
      await dispatch(
        updateProfile({
          firstName: nextFirst,
          lastName: nextLast,
          email: nextEmail,
          jobTitle: role.trim() || "Team member",
          dailyTargetHours: hours,
        })
      ).unwrap();
      toast.success("Settings saved");
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  const themeButton = (value: ThemeMode, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => dispatch(setTheme(value))}
      className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
        mode === value
          ? "border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
          : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="h-full overflow-y-auto pr-1">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Profile and the hour target are saved to your organization.
          </p>
        </div>

        <form onSubmit={handleSave} className={`${cardClass} space-y-4 p-5`}>
          <h3 className="font-semibold text-gray-900 dark:text-white">Profile</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="first-name">
                First name
              </label>
              <input id="first-name" className={fieldClass} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="last-name">
                Last name
              </label>
              <input id="last-name" className={fieldClass} value={lastName} onChange={(event) => setLastName(event.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="settings-email">
              Email
            </label>
            <input
              id="settings-email"
              type="email"
              className={fieldClass}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className={labelClass}>Organization</p>
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-100">
                {user?.organizationName}
              </p>
            </div>
            <div>
              <p className={labelClass}>Access</p>
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-100">
                Employee
              </p>
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="role">
              Job title
            </label>
            <input id="role" className={fieldClass} value={role} onChange={(event) => setRole(event.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="target">
              Daily hour target
            </label>
            <input
              id="target"
              type="number"
              min={1}
              max={16}
              step={0.5}
              className={fieldClass}
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            />
          </div>
          <button type="submit" className={primaryButtonClass} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </form>

        <section className={`${cardClass} p-5`}>
          <h3 className="font-semibold text-gray-900 dark:text-white">Appearance</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            The same switch lives in the sidebar.
          </p>
          <div className="mt-4 flex gap-2">
            {themeButton("light", "Light")}
            {themeButton("dark", "Dark")}
          </div>
        </section>
      </div>
    </div>
  );
}
