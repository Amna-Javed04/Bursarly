"use client";

/**
 * /dashboard — authenticated user's scholarship tracker.
 *
 * Features:
 *  - Tracked scholarships sorted by nearest deadline
 *  - Color-shifting countdown bar: green→amber→red as deadline nears
 *  - Document checklist per scholarship (interactive checkboxes stored in localStorage)
 *  - Status selector (interested / tracking / applied)
 *  - Remove button
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import AuthGuard from "@/app/components/AuthGuard";
import PageTransition from "@/app/components/PageTransition";
import {
  getMyTrackedScholarships,
  updateTrackerStatus,
  removeFromTracker,
  getMyProfile,
  type UserScholarship,
  type UserProfile,
} from "@/app/lib/api";
import {
  daysUntilDeadline,
  formatDeadlineDate,
  formatDaysRemaining,
  getCountryFlag,
} from "@/app/lib/utils";
import { useAuth } from "@/app/context/AuthContext";

// ── Countdown Bar ─────────────────────────────────────────────

/**
 * Renders a gradient bar + pulsing dot that shifts color based on days remaining.
 * > 30 days: green (#4CAF7D)
 * 8-30 days: amber (#E3A008)
 * 1-7 days:  red (#E4572E)  — also pulses
 */
function DeadlineCountdown({ deadlineDate }: { deadlineDate: string }) {
  const days = daysUntilDeadline(deadlineDate);
  const isPassed = days <= 0;

  // Color stops based on urgency
  let barColor: string;
  let textColor: string;
  let pulse = false;

  if (isPassed) {
    barColor = "#9CA3AF";
    textColor = "#9CA3AF";
  } else if (days <= 7) {
    barColor = "#E4572E";
    textColor = "#E4572E";
    pulse = true;
  } else if (days <= 30) {
    barColor = "#E3A008";
    textColor = "#E3A008";
  } else {
    barColor = "#4CAF7D";
    textColor = "#4CAF7D";
  }

  // Fill % — capped at 90 days max for visual range
  const fillPct = isPassed ? 0 : Math.min(100, (days / 90) * 100);

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold" style={{ color: textColor }}>
          {isPassed ? "Deadline passed" : formatDaysRemaining(deadlineDate)}
        </span>
        <span className="text-xs text-text-muted">{formatDeadlineDate(deadlineDate)}</span>
      </div>

      {/* Bar */}
      <div className="relative h-2 rounded-full bg-border overflow-hidden">
        <motion.div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ backgroundColor: barColor }}
          initial={{ width: 0 }}
          animate={{ width: `${fillPct}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
        />
      </div>

      {/* Pulsing dot for urgent */}
      {pulse && !isPassed && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: barColor }} />
            <span className="relative inline-flex rounded-full h-2 w-2"
              style={{ backgroundColor: barColor }} />
          </span>
          <span className="text-xs font-medium" style={{ color: barColor }}>Deadline approaching!</span>
        </div>
      )}
    </div>
  );
}

// ── Document Checklist ────────────────────────────────────────

const COMMON_DOCS = [
  "Passport / National ID",
  "Transcripts (official)",
  "Proof of English proficiency",
  "Letters of Recommendation (2–3)",
  "Statement of Purpose / Personal Statement",
  "CV / Résumé",
  "Research Proposal (if applicable)",
  "Financial documents",
];

function DocumentChecklist({ scholarshipId, documents }: {
  scholarshipId: string;
  documents: Array<{ id: string; document_name: string; is_required: boolean }>;
}) {
  const [open, setOpen] = useState(false);
  const storageKey = `bursarly-docs-${scholarshipId}`;

  const [checked, setChecked] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  function toggle(label: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { }
      return next;
    });
  }

  // Merge scholarship-specific docs with common docs (deduplicate by name)
  const specificDocs = documents.map((d) => ({ name: d.document_name, required: d.is_required }));
  const specificNames = new Set(specificDocs.map((d) => d.name.toLowerCase()));
  const extraDocs = COMMON_DOCS.filter((d) => !specificNames.has(d.toLowerCase())).map((n) => ({ name: n, required: false }));
  const allDocs = [...specificDocs, ...extraDocs];

  const completedCount = allDocs.filter((d) => checked.has(d.name)).length;

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs font-semibold text-navy hover:text-teal transition-colors"
        aria-expanded={open}
      >
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Documents ({completedCount}/{allDocs.length} ready)
        {/* Mini progress */}
        <div className="flex-1 h-1 rounded-full bg-border overflow-hidden max-w-[80px]">
          <div
            className="h-full rounded-full bg-teal transition-all duration-300"
            style={{ width: `${allDocs.length ? (completedCount / allDocs.length) * 100 : 0}%` }}
          />
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-3 space-y-2"
          >
            {allDocs.map((doc) => (
              <label
                key={doc.name}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <div
                  onClick={() => toggle(doc.name)}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer
                    ${checked.has(doc.name) ? "bg-teal border-teal" : "border-border group-hover:border-teal/50"}`}
                >
                  {checked.has(doc.name) && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={`text-xs transition-colors ${checked.has(doc.name) ? "line-through text-text-muted" : "text-text-secondary group-hover:text-navy"}`}>
                  {doc.name}
                  {doc.required && <span className="ml-1 text-deadline-urgent">*</span>}
                </span>
              </label>
            ))}
            <p className="text-xs text-text-muted pt-1">* Required by scholarship</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Status Badge ──────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "interested", label: "Interested", color: "bg-navy/10 text-navy" },
  { value: "tracking", label: "Tracking", color: "bg-deadline-warning/10 text-deadline-warning" },
  { value: "applied", label: "Applied ✓", color: "bg-deadline-safe/10 text-deadline-safe" },
] as const;

function StatusSelector({
  trackerId,
  current,
  onChange,
}: {
  trackerId: string;
  current: "interested" | "tracking" | "applied";
  onChange: (newStatus: "interested" | "tracking" | "applied") => void;
}) {
  const [updating, setUpdating] = useState(false);

  async function handleChange(newVal: "interested" | "tracking" | "applied") {
    if (newVal === current || updating) return;
    setUpdating(true);
    try {
      await updateTrackerStatus(trackerId, newVal);
      onChange(newVal);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="flex gap-1.5 mt-3 flex-wrap">
      {STATUS_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => handleChange(opt.value)}
          disabled={updating}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 border
            ${current === opt.value
              ? `${opt.color} border-current/30 shadow-sm scale-105`
              : "border-border text-text-muted hover:border-navy/20 hover:text-navy"
            } disabled:opacity-60`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Tracker Card ──────────────────────────────────────────────

function TrackerCard({
  item,
  onStatusChange,
  onRemove,
}: {
  item: UserScholarship;
  onStatusChange: (id: string, s: "interested" | "tracking" | "applied") => void;
  onRemove: (id: string) => void;
}) {
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    if (removing) return;
    if (!confirm(`Remove "${item.scholarship.name}" from your tracker?`)) return;
    setRemoving(true);
    try {
      await removeFromTracker(item.id);
      onRemove(item.id);
    } catch {
      setRemoving(false);
    }
  }

  const nearestDeadline = item.scholarship.nearest_deadline;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-2xl border border-border/60 shadow-[var(--shadow-card)] p-5 sm:p-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{getCountryFlag(item.scholarship.country)}</span>
            <span className="text-xs text-text-muted">{item.scholarship.country}</span>
          </div>
          <Link
            href={`/scholarship/${item.scholarship.id}`}
            className="text-base font-semibold text-navy hover:text-teal-dark transition-colors line-clamp-2"
          >
            {item.scholarship.name}
          </Link>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="px-2 py-0.5 rounded-md text-xs bg-teal/8 text-teal-dark font-medium">
              {item.scholarship.degree_level}
            </span>
            <span className="px-2 py-0.5 rounded-md text-xs bg-navy/5 text-navy/70">
              {item.scholarship.funding_type.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        {/* Remove */}
        <button
          type="button"
          onClick={handleRemove}
          disabled={removing}
          aria-label="Remove from tracker"
          className="p-1.5 rounded-lg text-text-muted hover:text-deadline-urgent hover:bg-deadline-urgent/5 transition-colors disabled:opacity-50 shrink-0"
        >
          {removing ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Deadline countdown */}
      {nearestDeadline ? (
        <DeadlineCountdown deadlineDate={nearestDeadline} />
      ) : (
        <p className="text-xs text-text-muted mt-3">No upcoming deadline</p>
      )}

      {/* Status selector */}
      <StatusSelector
        trackerId={item.id}
        current={item.status}
        onChange={(s) => onStatusChange(item.id, s)}
      />

      {/* Document checklist */}
      <DocumentChecklist
        scholarshipId={item.scholarship.id}
        documents={[]}
      />
    </motion.div>
  );
}

// ── Dashboard content ─────────────────────────────────────────

function DashboardContent() {
  const { user } = useAuth();
  const [tracked, setTracked] = useState<UserScholarship[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [items, prof] = await Promise.allSettled([
        getMyTrackedScholarships(),
        getMyProfile(),
      ]);
      if (items.status === "fulfilled") setTracked(items.value);
      if (prof.status === "fulfilled") setProfile(prof.value);
    } catch {
      setError("Failed to load your dashboard. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleStatusChange(id: string, newStatus: "interested" | "tracking" | "applied") {
    setTracked((prev) =>
      prev.map((t) => t.id === id ? { ...t, status: newStatus } : t)
    );
  }

  function handleRemove(id: string) {
    setTracked((prev) => prev.filter((t) => t.id !== id));
  }

  const appliedCount = tracked.filter(t => t.status === "applied").length;
  const trackingCount = tracked.filter(t => t.status === "tracking").length;
  const urgentCount = tracked.filter(t =>
    t.scholarship.nearest_deadline && daysUntilDeadline(t.scholarship.nearest_deadline) <= 14
  ).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-navy">My Dashboard</h1>
            <p className="text-text-secondary text-sm mt-1">
              {user?.email} · {tracked.length} scholarship{tracked.length !== 1 ? "s" : ""} tracked
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/preferences"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border
                text-sm font-medium text-text-secondary hover:text-navy hover:border-navy/30
                transition-colors duration-200">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Preferences
            </Link>
            <Link href="/browse"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold
                text-sm text-white bg-gradient-to-r from-navy to-teal
                hover:from-navy-light hover:to-teal-light transition-all duration-200 shadow-sm">
              + Browse Scholarships
            </Link>
          </div>
        </div>

        {/* Stat pills */}
        {!loading && tracked.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="flex flex-wrap gap-3 mt-5">
            {[
              { label: "Applied", count: appliedCount, color: "text-deadline-safe bg-deadline-safe/10 border-deadline-safe/20" },
              { label: "Tracking", count: trackingCount, color: "text-deadline-warning bg-deadline-warning/10 border-deadline-warning/20" },
              { label: "Deadline < 2 weeks", count: urgentCount, color: "text-deadline-urgent bg-deadline-urgent/10 border-deadline-urgent/20" },
            ].map((stat) => (
              <div key={stat.label}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${stat.color}`}>
                <span className="text-base font-bold">{stat.count}</span>
                {stat.label}
              </div>
            ))}
          </motion.div>
        )}
      </motion.div>

      {/* Profile nudge if not filled */}
      {!loading && !profile && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="mb-6 p-4 rounded-xl bg-teal/5 border border-teal/20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-teal/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-navy">Personalise your recommendations</p>
              <p className="text-xs text-text-secondary">Tell us your degree level and target countries for tailored scholarship suggestions.</p>
            </div>
          </div>
          <Link href="/onboarding"
            className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-teal hover:bg-teal-dark transition-colors">
            Set up →
          </Link>
        </motion.div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-deadline-urgent/5 border border-deadline-urgent/20 text-deadline-urgent text-sm font-medium">
          {error}
          <button onClick={load} className="ml-3 underline text-xs">Retry</button>
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-52 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && tracked.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl
            bg-gradient-to-br from-navy/5 to-teal/5 border border-border mb-5">
            <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-navy mb-2">No scholarships tracked yet</h2>
          <p className="text-text-secondary text-sm mb-6 max-w-xs mx-auto">
            Browse scholarships and click "Add to My Tracker" to start tracking deadlines here.
          </p>
          <Link href="/browse"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm
              text-white bg-gradient-to-r from-navy to-teal hover:from-navy-light hover:to-teal-light
              transition-all duration-200 shadow-sm">
            Browse Scholarships
          </Link>
        </motion.div>
      )}

      {/* Cards grid */}
      {!loading && !error && tracked.length > 0 && (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          <AnimatePresence mode="popLayout">
            {tracked.map((item) => (
              <TrackerCard
                key={item.id}
                item={item}
                onStatusChange={handleStatusChange}
                onRemove={handleRemove}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <PageTransition>
        <DashboardContent />
      </PageTransition>
    </AuthGuard>
  );
}
