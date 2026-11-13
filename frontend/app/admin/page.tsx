"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ScholarshipDetail,
  SourceHealth,
  getPendingScholarships,
  getSourceHealth,
  updateScholarshipAdmin,
  ApiError,
} from "@/app/lib/api";

function Kpi({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.05] bg-white p-4">
      <p className="font-display text-3xl leading-none text-navy">{value}</p>
      <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.14em] text-text-muted">{label}</p>
      {hint && <p className="mt-1 text-[11px] text-text-muted">{hint}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const [scholarships, setScholarships] = useState<ScholarshipDetail[]>([]);
  const [health, setHealth] = useState<SourceHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [pending, sourceHealth] = await Promise.allSettled([
      getPendingScholarships(),
      getSourceHealth(),
    ]);

    if (pending.status === "fulfilled") setScholarships(pending.value);
    if (sourceHealth.status === "fulfilled") setHealth(sourceHealth.value);

    const failure = pending.status === "rejected" ? pending.reason : sourceHealth.status === "rejected" ? sourceHealth.reason : null;

    if (failure) {
      if (failure instanceof ApiError && (failure.status === 401 || failure.status === 403)) {
        setError("You do not have permission to view this page. Admin access required.");
      } else {
        setError(failure.message || "Failed to load the admin dashboard.");
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await updateScholarshipAdmin(id, { status: newStatus });
      setScholarships((prev) => prev.filter((s) => s.id !== id));
      void load();
    } catch (err) {
      alert("Failed to update status: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const handleEditName = async (scholarship: ScholarshipDetail) => {
    const newName = prompt("Edit scholarship name:", scholarship.name);
    if (!newName || newName === scholarship.name) return;
    try {
      await updateScholarshipAdmin(scholarship.id, { name: newName });
      setScholarships((prev) =>
        prev.map((s) => (s.id === scholarship.id ? { ...s, name: newName } : s))
      );
    } catch (err) {
      alert("Failed to update name: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        <div className="w-full rounded-3xl border border-black/[0.06] bg-white p-8">
          <h2 className="text-lg font-semibold text-navy">Access denied</h2>
          <p className="mt-3 text-sm text-text-secondary">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="mt-6 rounded-xl bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-light"
          >
            Return home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-jade-deep">Operations</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-navy">Data quality &amp; review</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Source health, the review queue and what students asked for that we don&apos;t have yet.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="rounded-xl border border-black/10 px-4 py-2 text-sm font-medium text-navy transition-colors hover:bg-navy/[0.04]"
        >
          Refresh
        </button>
      </header>

      {health && (
        <>
          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Approved" value={health.approved} />
            <Kpi label="Awaiting review" value={health.pending} />
            <Kpi label="Needs fixing" value={health.needs_fix} />
            <Kpi
              label="Confirmed deadlines"
              value={health.confirmed_deadlines}
              hint={`${health.unconfirmed_deadlines} unconfirmed`}
            />
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Source health */}
            <section className="rounded-2xl border border-black/[0.05] bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-navy">Official source health</h2>
                <span className="text-[11px] text-text-muted">
                  {health.last_checked_at
                    ? `Checked ${new Date(health.last_checked_at).toLocaleDateString()}`
                    : "Never checked"}
                </span>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                {Object.entries(health.by_source_check).map(([key, count]) => (
                  <span
                    key={key}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                      key === "verified"
                        ? "border-deadline-safe/25 bg-deadline-safe/10 text-deadline-safe"
                        : key === "blocked"
                          ? "border-deadline-warning/25 bg-deadline-warning/10 text-deadline-warning"
                          : "border-border bg-surface-raised text-text-secondary"
                    }`}
                  >
                    {key.replace("_", " ")} · {count}
                  </span>
                ))}
              </div>

              {health.blocked.length === 0 ? (
                <p className="text-xs text-text-muted">Every official page is readable.</p>
              ) : (
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
                    Pages we cannot read automatically ({health.blocked.length})
                  </p>
                  <ul className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                    {health.blocked.map((source) => (
                      <li key={source.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-text-secondary">{source.name}</span>
                        {source.official_url && (
                          <a
                            href={source.official_url}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 text-[11px] text-teal-dark hover:underline"
                          >
                            Open ↗
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* Missing requirements */}
            <section className="rounded-2xl border border-black/[0.05] bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-navy">Listings missing requirements</h2>
              {health.missing_requirements.length === 0 ? (
                <p className="text-xs text-text-muted">Every approved listing has documents listed.</p>
              ) : (
                <>
                  <p className="mb-2 text-[11px] text-text-muted">
                    {health.missing_requirements.length} listing(s) have no documents or eligibility criteria yet.
                  </p>
                  <ul className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                    {health.missing_requirements.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-text-secondary">{item.name}</span>
                        <Link
                          href={`/scholarship/${item.id}`}
                          className="shrink-0 text-[11px] text-teal-dark hover:underline"
                        >
                          View
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>
        </>
      )}

      {/* Review queue */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-navy">Review queue</h2>
        {scholarships.length === 0 ? (
          <div className="rounded-2xl border border-black/[0.05] bg-white p-10 text-center">
            <p className="text-sm text-text-secondary">Nothing is waiting for review.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-black/[0.05] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-raised text-[11px] uppercase tracking-[0.1em] text-text-muted">
                  <tr>
                    <th className="px-5 py-3 font-medium">Programme</th>
                    <th className="px-5 py-3 font-medium">Country</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Source</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {scholarships.map((scholarship) => (
                    <motion.tr
                      key={scholarship.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="transition-colors hover:bg-surface-raised/60"
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-navy">{scholarship.name}</p>
                        <p className="mt-0.5 text-[11px] text-text-muted">
                          {scholarship.degree_level} · {scholarship.funding_type.replace(/_/g, " ")}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-text-secondary">{scholarship.country}</td>
                      <td className="px-5 py-3">
                        <span className="rounded-full bg-deadline-warning/10 px-2.5 py-0.5 text-[11px] font-medium text-deadline-warning">
                          {scholarship.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-text-secondary">
                        <span className="text-[11px]">{scholarship.source_type}</span>
                        {scholarship.official_url && (
                          <a
                            href={scholarship.official_url}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-[11px] text-teal-dark hover:underline"
                          >
                            View source
                          </a>
                        )}
                      </td>
                      <td className="space-x-3 px-5 py-3 text-right">
                        <button onClick={() => handleEditName(scholarship)} className="text-[12px] font-medium text-indigo-600 hover:text-indigo-700">
                          Edit
                        </button>
                        <button onClick={() => handleUpdateStatus(scholarship.id, "approved")} className="text-[12px] font-medium text-deadline-safe hover:opacity-80">
                          Approve
                        </button>
                        <button onClick={() => handleUpdateStatus(scholarship.id, "rejected")} className="text-[12px] font-medium text-deadline-urgent hover:opacity-80">
                          Reject
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Unmatched queries */}
      {health && health.recent_unmatched.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold text-navy">What students asked for</h2>
          <p className="mb-3 text-xs text-text-secondary">
            Queries the assistant could not answer from the catalogue — the shortlist for what to add next.
          </p>
          <ul className="space-y-2">
            {health.recent_unmatched.map((query) => (
              <li
                key={query.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-black/[0.05] bg-white px-4 py-2.5 text-xs"
              >
                <span className="truncate text-text-secondary">{query.query_text}</span>
                <span className="shrink-0 text-[11px] text-text-muted">
                  {new Date(query.asked_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
