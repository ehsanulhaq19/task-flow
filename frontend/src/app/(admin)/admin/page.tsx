"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminIntro } from "@/components/admin/AdminShell";
import { cardClass } from "@/constants/ui";
import { apiError } from "@/services/api";
import { fetchSummary, type AdminSummary } from "@/services/admin";

const cards: { key: keyof AdminSummary; label: string; href: string; hint: string }[] = [
  { key: "organizations", label: "Organizations", href: "/admin/organizations", hint: "Companies on Taskflow" },
  { key: "users", label: "People", href: "/admin/users", hint: "Admins and employees" },
  { key: "tasks", label: "Tasks", href: "/admin/tasks", hint: "Cards across every board" },
  { key: "openTimers", label: "Open timers", href: "/admin/time", hint: "People currently timed in" },
  { key: "screenshots", label: "Screenshots", href: "/admin/time", hint: "Open a time log to see its frames" },
];

export default function AdminOverviewPage() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchSummary()
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(apiError(err, "Could not load the overview"));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <AdminIntro title="Overview" text="Organizations, people, tasks, and the time captured while they work." />
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.key} href={card.href} className={`${cardClass} p-5 transition hover:-translate-y-0.5 hover:shadow-md`}>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-gray-900 dark:text-white">
              {summary ? summary[card.key] : "—"}
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{card.hint}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
