"use client";

/**
 * /preferences — edit onboarding answers at any time.
 * Same fields as onboarding but displayed as a settings page (not a wizard).
 * Saving refreshes browse-page suggestions because browse auto-filters
 * by the user's countries_of_interest when navigated from here.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import AuthGuard from "@/app/components/AuthGuard";
import { getMyProfile, updateMyProfile, type UserProfile, type UserProfileUpdate } from "@/app/lib/api";

const DEGREE_LEVELS = [
  { value: "undergraduate", label: "Bachelor's / Undergraduate" },
  { value: "masters", label: "Master's" },
  { value: "phd", label: "PhD / Doctoral" },
  { value: "postdoc", label: "Postdoctoral" },
  { value: "other", label: "Other / Not sure" },
];

const COUNTRIES = [
  "Germany", "Turkey", "South Korea", "European Union",
  "United States", "United Kingdom", "Canada", "Australia",
  "Japan", "France", "Netherlands", "Sweden",
];

const FIELDS_OF_STUDY = [
  "Computer Science / IT", "Engineering", "Medicine / Health Sciences",
  "Business / Economics", "Arts & Humanities", "Social Sciences",
  "Law", "Natural Sciences", "Education", "Other",
];

// ── Sub-components ────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-border/60 shadow-[var(--shadow-card)] overflow-hidden">
      <div className="px-6 py-4 border-b border-border/50 bg-surface-raised">
        <h2 className="text-sm font-semibold text-navy">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ── Preferences content ───────────────────────────────────────

interface FormState {
  degree_level: string;
  countries_of_interest: string[];
  field_of_study: string;
  needs_full_funding: boolean;
}

function PreferencesContent() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    degree_level: "",
    countries_of_interest: [],
    field_of_study: "",
    needs_full_funding: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Load existing profile
  useEffect(() => {
    (async () => {
      try {
        const profile = await getMyProfile();
        setForm({
          degree_level: profile.degree_level ?? "",
          countries_of_interest: profile.countries_of_interest ?? [],
          field_of_study: profile.field_of_study ?? "",
          needs_full_funding: profile.needs_full_funding ?? false,
        });
      } catch {
        // Profile might not exist yet (first time) — use defaults
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function toggleCountry(c: string) {
    setForm((prev) => ({
      ...prev,
      countries_of_interest: prev.countries_of_interest.includes(c)
        ? prev.countries_of_interest.filter((x) => x !== c)
        : [...prev.countries_of_interest, c],
    }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await updateMyProfile({
        degree_level: form.degree_level || null,
        countries_of_interest: form.countries_of_interest,
        field_of_study: form.field_of_study || null,
        needs_full_funding: form.needs_full_funding,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Failed to save preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-32 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-teal mb-4 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-navy">My Preferences</h1>
        <p className="text-text-secondary text-sm mt-1">
          Update your answers to get better scholarship matches on the browse page.
        </p>
      </motion.div>

      <div className="space-y-5">

        {/* Degree Level */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <SectionCard title="Degree Level">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {DEGREE_LEVELS.map((d) => (
                <button key={d.value} type="button"
                  onClick={() => { setForm(f => ({ ...f, degree_level: d.value })); setSaved(false); }}
                  className={`px-4 py-3 rounded-xl border-2 text-sm text-left transition-all duration-200
                    ${form.degree_level === d.value
                      ? "border-teal bg-teal/5 text-navy font-medium"
                      : "border-border hover:border-navy/20 text-text-secondary"
                    }`}>
                  {d.label}
                </button>
              ))}
            </div>
          </SectionCard>
        </motion.div>

        {/* Countries */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <SectionCard title="Countries of Interest">
            <p className="text-xs text-text-muted mb-3">
              Selected countries will be pre-filtered when you browse scholarships.
              {form.countries_of_interest.length > 0 && (
                <> <span className="font-semibold text-navy">{form.countries_of_interest.length} selected.</span></>
              )}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {COUNTRIES.map((c) => {
                const on = form.countries_of_interest.includes(c);
                return (
                  <button key={c} type="button" onClick={() => toggleCountry(c)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm transition-all duration-200
                      ${on ? "border-teal bg-teal/5 text-navy font-medium" : "border-border hover:border-navy/20 text-text-secondary"}`}>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all
                      ${on ? "bg-teal border-teal" : "border-border"}`}>
                      {on && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="truncate">{c}</span>
                  </button>
                );
              })}
            </div>
          </SectionCard>
        </motion.div>

        {/* Field of Study */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <SectionCard title="Field of Study">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FIELDS_OF_STUDY.map((f) => (
                <button key={f} type="button"
                  onClick={() => { setForm(prev => ({ ...prev, field_of_study: f })); setSaved(false); }}
                  className={`px-4 py-3 rounded-xl border-2 text-sm text-left transition-all duration-200
                    ${form.field_of_study === f
                      ? "border-teal bg-teal/5 text-navy font-medium"
                      : "border-border hover:border-navy/20 text-text-secondary"
                    }`}>
                  {f}
                </button>
              ))}
            </div>
          </SectionCard>
        </motion.div>

        {/* Funding Need */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <SectionCard title="Funding Need">
            <div className="space-y-3">
              {[
                { v: true, label: "Full funding required", sub: "Tuition + living stipend", icon: "💰" },
                { v: false, label: "Partial funding is fine", sub: "I can cover some costs", icon: "🎯" },
              ].map((opt) => (
                <button key={String(opt.v)} type="button"
                  onClick={() => { setForm(f => ({ ...f, needs_full_funding: opt.v })); setSaved(false); }}
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 text-left transition-all duration-200
                    ${form.needs_full_funding === opt.v
                      ? "border-teal bg-teal/5 text-navy"
                      : "border-border hover:border-navy/20 text-text-secondary"
                    }`}>
                  <span className="text-2xl">{opt.icon}</span>
                  <div>
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className="text-xs text-text-muted">{opt.sub}</p>
                  </div>
                  {form.needs_full_funding === opt.v && (
                    <svg className="w-5 h-5 text-teal ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </SectionCard>
        </motion.div>

        {/* Save button + feedback */}
        <AnimatePresence>
          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-sm text-deadline-urgent font-medium" role="alert">
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between pt-2">
          <AnimatePresence>
            {saved && (
              <motion.span
                key="saved"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="flex items-center gap-2 text-sm text-deadline-safe font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Preferences saved!
              </motion.span>
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            onClick={handleSave}
            disabled={saving}
            whileTap={{ scale: 0.97 }}
            id="preferences-save-btn"
            className="ml-auto px-6 py-3 rounded-xl font-semibold text-sm text-white
              bg-gradient-to-r from-navy to-teal hover:from-navy-light hover:to-teal-light
              disabled:opacity-60 disabled:cursor-not-allowed
              transition-all duration-200 shadow-sm"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </span>
            ) : "Save Preferences"}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

export default function PreferencesPage() {
  return (
    <AuthGuard>
      <PreferencesContent />
    </AuthGuard>
  );
}
