"use client";

import { Fragment, useEffect, useState } from "react";
import { HiOutlineChevronDown } from "react-icons/hi2";
import { AdminIntro } from "@/components/admin/AdminShell";
import { cardClass, fieldClass } from "@/constants/ui";
import { formatDateTime, formatHours } from "@/lib/format";
import { apiError } from "@/services/api";
import type { ApiUser } from "@/services/employee";
import {
  fetchOrganizations,
  fetchScreenshotBlob,
  fetchTimeEntries,
  fetchTimeEntryScreenshots,
  fetchUsers,
  type AdminScreenshot,
  type AdminTimeEntry,
  type OrgRecord,
} from "@/services/admin";

function duration(entry: AdminTimeEntry) {
  if (!entry.endedAt) return "Running";
  const ms = new Date(entry.endedAt).getTime() - new Date(entry.startedAt).getTime();
  return formatHours(ms);
}

function screenshotLabel(count: number) {
  return count === 1 ? "1 screenshot" : `${count} screenshots`;
}

function ShotCard({ shot, onOpen }: { shot: AdminScreenshot; onOpen: (shot: AdminScreenshot, url: string) => void }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;
    fetchScreenshotBlob(shot.id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl("");
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [shot.id]);

  return (
    <button
      type="button"
      onClick={() => url && onOpen(shot, url)}
      className="overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="aspect-video bg-gray-100 dark:bg-gray-800">
        {url ? <img src={url} alt={`Screenshot from ${shot.userName}`} className="h-full w-full object-cover" /> : null}
      </div>
      <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">{formatDateTime(shot.takenAt)}</p>
    </button>
  );
}

export default function TimeLogsPage() {
  const [organizations, setOrganizations] = useState<OrgRecord[]>([]);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [entries, setEntries] = useState<AdminTimeEntry[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [shots, setShots] = useState<Record<string, AdminScreenshot[] | "loading" | "error">>({});
  const [preview, setPreview] = useState<{ shot: AdminScreenshot; url: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchOrganizations(), fetchUsers()])
      .then(([orgs, people]) => {
        if (cancelled) return;
        setOrganizations(orgs);
        setUsers(people);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(apiError(err, "Could not load filters"));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setOpenId(null);
    fetchTimeEntries({
      organizationId: organizationId || undefined,
      userId: userId || undefined,
    })
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(apiError(err, "Could not load time logs"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, userId]);

  const people = organizationId ? users.filter((user) => user.organizationId === organizationId) : users;

  const toggleShots = (entryId: string) => {
    if (openId === entryId) {
      setOpenId(null);
      return;
    }
    setOpenId(entryId);
    const cached = shots[entryId];
    if (cached && cached !== "error") return;
    setShots((current) => ({ ...current, [entryId]: "loading" }));
    fetchTimeEntryScreenshots(entryId)
      .then((rows) => setShots((current) => ({ ...current, [entryId]: rows })))
      .catch(() => setShots((current) => ({ ...current, [entryId]: "error" })));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <AdminIntro
        title="Time logs"
        text="Each duration opens the screenshots captured while that person was timed in."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <select
          className={fieldClass}
          value={organizationId}
          aria-label="Organization"
          onChange={(event) => {
            setOrganizationId(event.target.value);
            setUserId("");
          }}
        >
          <option value="">All organizations</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
        <select className={fieldClass} value={userId} aria-label="Person" onChange={(event) => setUserId(event.target.value)}>
          <option value="">All people</option>
          {people.map((user) => (
            <option key={user.id} value={user.id}>
              {user.firstName} {user.lastName}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3 font-medium">Person</th>
              <th className="px-4 py-3 font-medium">Task</th>
              <th className="px-4 py-3 font-medium">Started</th>
              <th className="px-4 py-3 font-medium">Stopped</th>
              <th className="px-4 py-3 font-medium">Duration</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={5}>
                  Loading time logs...
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={5}>
                  No time entries match these filters.
                </td>
              </tr>
            ) : (
              entries.map((entry) => {
                const open = openId === entry.id;
                const panel = shots[entry.id];
                return (
                  <Fragment key={entry.id}>
                    <tr className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-white">{entry.userName}</p>
                        <p className="text-xs text-gray-500">{entry.organizationName}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                        {entry.taskKey ? `${entry.taskKey} · ${entry.taskTitle}` : "No task"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDateTime(entry.startedAt)}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {entry.endedAt ? formatDateTime(entry.endedAt) : "Still running"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          aria-expanded={open}
                          onClick={() => toggleShots(entry.id)}
                          className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          <span className="font-medium text-gray-900 dark:text-white">{duration(entry)}</span>
                          <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/40 dark:text-primary-200">
                            {screenshotLabel(entry.screenshotCount)}
                          </span>
                          <HiOutlineChevronDown className={`h-4 w-4 text-gray-400 transition ${open ? "rotate-180" : ""}`} />
                        </button>
                      </td>
                    </tr>
                    {open ? (
                      <tr className="border-t border-gray-100 dark:border-gray-800">
                        <td colSpan={5} className="bg-gray-50 px-4 py-4 dark:bg-gray-950/50">
                          {panel === "loading" || panel === undefined ? (
                            <p className="text-sm text-gray-500">Loading screenshots...</p>
                          ) : panel === "error" ? (
                            <p className="text-sm text-rose-600">Could not load screenshots for this time log.</p>
                          ) : panel.length === 0 ? (
                            <p className="text-sm text-gray-500">No screenshots were captured during this time log.</p>
                          ) : (
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              {panel.map((shot) => (
                                <ShotCard
                                  key={shot.id}
                                  shot={shot}
                                  onOpen={(item, url) => setPreview({ shot: item, url })}
                                />
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {preview ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/70" aria-label="Close preview" onClick={() => setPreview(null)} />
          <figure className="relative z-10 w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            <img src={preview.url} alt={`Screenshot from ${preview.shot.userName}`} className="max-h-[75vh] w-full object-contain bg-black" />
            <figcaption className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="font-medium text-gray-900 dark:text-white">
                {preview.shot.userName}
                {preview.shot.taskKey ? ` · ${preview.shot.taskKey}` : ""}
              </span>
              <span className="text-gray-500">{formatDateTime(preview.shot.takenAt)}</span>
            </figcaption>
          </figure>
        </div>
      ) : null}
    </div>
  );
}
