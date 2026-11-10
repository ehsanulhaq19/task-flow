"use client";

import { FormEvent, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { AdminIntro } from "@/components/admin/AdminShell";
import { cardClass, fieldClass, labelClass, primaryButtonClass } from "@/constants/ui";
import { formatDay } from "@/lib/format";
import { apiError } from "@/services/api";
import { createOrganization, fetchOrganizations, type OrgRecord } from "@/services/admin";

export default function OrganizationsPage() {
  const [rows, setRows] = useState<OrgRecord[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchOrganizations()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(apiError(err, "Could not load organizations"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const created = await createOrganization({ name: name.trim(), slug: slug.trim() || undefined });
      setRows((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setSlug("");
      toast.success(`${created.name} created`);
    } catch (err) {
      toast.error(apiError(err, "Could not create the organization"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <AdminIntro title="Organizations" text="Each person belongs to one organization. Create one before adding its people." />
      <form onSubmit={handleSubmit} className={`${cardClass} grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end`}>
        <div>
          <label className={labelClass} htmlFor="org-name">
            Name
          </label>
          <input id="org-name" required minLength={2} className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="Northwind" />
        </div>
        <div>
          <label className={labelClass} htmlFor="org-slug">
            Slug
          </label>
          <input id="org-slug" className={fieldClass} value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="Optional" />
        </div>
        <button type="submit" className={primaryButtonClass} disabled={saving}>
          {saving ? "Creating..." : "Create"}
        </button>
      </form>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={3}>
                  Loading organizations...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={3}>
                  No organizations yet.
                </td>
              </tr>
            ) : (
              rows.map((org) => (
                <tr key={org.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{org.name}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{org.slug}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDay(new Date(org.createdAt))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
