"use client";

import { FormEvent, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { AdminIntro } from "@/components/admin/AdminShell";
import { cardClass, fieldClass, labelClass, primaryButtonClass } from "@/constants/ui";
import { apiError } from "@/services/api";
import type { ApiUser } from "@/services/employee";
import { createUser, fetchOrganizations, fetchUsers, updateUserLimits, type OrgRecord } from "@/services/admin";

function limitDrafts(people: ApiUser[]) {
  return Object.fromEntries(
    people
      .filter((user) => user.systemRole === "employee")
      .map((user) => [
        user.id,
        {
          minimumHours: String(user.configurationData?.minimumHours ?? user.dailyTargetHours),
          maximumHours: String(user.configurationData?.maximumHours ?? user.dailyTargetHours),
        },
      ]),
  );
}

export default function UsersPage() {
  const [organizations, setOrganizations] = useState<OrgRecord[]>([]);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [jobTitle, setJobTitle] = useState("Team member");
  const [role, setRole] = useState<"employee" | "admin">("employee");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [limits, setLimits] = useState<Record<string, { minimumHours: string; maximumHours: string }>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchOrganizations(), fetchUsers()])
      .then(([orgs, people]) => {
        if (cancelled) return;
        setOrganizations(orgs);
        setUsers(people);
        setLimits(limitDrafts(people));
        setOrganizationId(orgs[0]?.id ?? "");
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(apiError(err, "Could not load people"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = filter ? users.filter((user) => user.organizationId === filter) : users;

  const saveLimits = async (user: ApiUser) => {
    const draft = limits[user.id];
    const minimumHours = Number(draft?.minimumHours);
    const maximumHours = Number(draft?.maximumHours);
    if (!Number.isFinite(minimumHours) || !Number.isFinite(maximumHours) || minimumHours <= 0 || maximumHours < minimumHours || maximumHours > 24) {
      toast.error("Maximum must be at least the minimum, and both must be within 24 hours");
      return;
    }
    setSavingId(user.id);
    try {
      const saved = await updateUserLimits(user.id, { minimumHours, maximumHours });
      setUsers((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      setLimits((current) => ({ ...current, ...limitDrafts([saved]) }));
      toast.success("Daily limits saved");
    } catch (err) {
      toast.error(apiError(err, "Could not save daily limits"));
    } finally {
      setSavingId("");
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!organizationId) {
      toast.error("Create an organization first");
      return;
    }
    setSaving(true);
    try {
      const created = await createUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        organizationId,
        jobTitle: jobTitle.trim() || "Team member",
      });
      setUsers((current) => [...current, created].sort((a, b) => a.firstName.localeCompare(b.firstName)));
      setLimits((current) => ({ ...current, ...limitDrafts([created]) }));
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      toast.success(`${created.firstName} added`);
    } catch (err) {
      toast.error(apiError(err, "Could not create the user"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <AdminIntro
        title="People"
        text="Create an admin or an employee and assign them to an organization. Daily minimum and maximum hours can be set here for employees."
      />
      <form onSubmit={handleSubmit} className={`${cardClass} grid gap-4 p-5 sm:grid-cols-2`}>
        <div>
          <label className={labelClass} htmlFor="user-first">
            First name
          </label>
          <input id="user-first" required className={fieldClass} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="user-last">
            Last name
          </label>
          <input id="user-last" required className={fieldClass} value={lastName} onChange={(event) => setLastName(event.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="user-email">
            Email
          </label>
          <input id="user-email" type="email" required className={fieldClass} value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="user-password">
            Temporary password
          </label>
          <input id="user-password" type="text" required minLength={4} className={fieldClass} value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="user-org">
            Organization
          </label>
          <select id="user-org" required className={fieldClass} value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>
            {organizations.length === 0 ? <option value="">No organizations yet</option> : null}
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="user-role">
            Access
          </label>
          <select id="user-role" className={fieldClass} value={role} onChange={(event) => setRole(event.target.value as "admin" | "employee")}>
            <option value="employee">Employee</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="user-title">
            Job title
          </label>
          <input id="user-title" className={fieldClass} value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <button type="submit" className={primaryButtonClass} disabled={saving || organizations.length === 0}>
            {saving ? "Adding..." : "Add person"}
          </button>
        </div>
      </form>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">{visible.length} people</p>
        <select className={`${fieldClass} max-w-xs`} value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter by organization">
          <option value="">All organizations</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Organization</th>
              <th className="px-4 py-3 font-medium">Access</th>
              <th className="px-4 py-3 font-medium">Job title</th>
              <th className="px-4 py-3 font-medium">Minimum</th>
              <th className="px-4 py-3 font-medium">Maximum</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={7}>
                  Loading people...
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={7}>
                  No people match this filter.
                </td>
              </tr>
            ) : (
              visible.map((user) => (
                <tr key={user.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {user.firstName} {user.lastName}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{user.email}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{user.organizationName}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        user.systemRole === "admin"
                          ? "bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    >
                      {user.systemRole === "admin" ? "Admin" : "Employee"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{user.jobTitle}</td>
                  {user.systemRole === "employee" ? (
                    <>
                      <td className="px-4 py-3">
                        <input
                          aria-label={`Minimum hours for ${user.firstName} ${user.lastName}`}
                          type="number"
                          min={0.5}
                          max={24}
                          step={0.5}
                          value={limits[user.id]?.minimumHours ?? ""}
                          onChange={(event) =>
                            setLimits((current) => ({
                              ...current,
                              [user.id]: {
                                minimumHours: event.target.value,
                                maximumHours: current[user.id]?.maximumHours ?? "",
                              },
                            }))
                          }
                          className="w-20 rounded-lg border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            aria-label={`Maximum hours for ${user.firstName} ${user.lastName}`}
                            type="number"
                            min={0.5}
                            max={24}
                            step={0.5}
                            value={limits[user.id]?.maximumHours ?? ""}
                            onChange={(event) =>
                              setLimits((current) => ({
                                ...current,
                                [user.id]: {
                                  minimumHours: current[user.id]?.minimumHours ?? "",
                                  maximumHours: event.target.value,
                                },
                              }))
                            }
                            className="w-20 rounded-lg border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                          />
                          <button
                            type="button"
                            onClick={() => void saveLimits(user)}
                            disabled={savingId === user.id}
                            className="rounded-lg bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            {savingId === user.id ? "Saving" : "Save"}
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-gray-400">—</td>
                      <td className="px-4 py-3 text-gray-400">—</td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
