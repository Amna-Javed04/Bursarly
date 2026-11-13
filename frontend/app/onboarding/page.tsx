"use client";

/**
 * /onboarding — multi-step questionnaire shown immediately after first signup.
 * Saves answers to the backend PUT /user-profile/me endpoint.
 *
 * Steps:
 *   1. Degree Level
 *   2. Countries of Interest (multi-select)
 *   3. Field of Study
 *   4. Funding Need
 *
 * After saving, redirects to /dashboard.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import AuthGuard from "@/app/components/AuthGuard";
import PageTransition from "@/app/components/PageTransition";
import { updateMyProfile } from "@/app/lib/api";

// ── Data ──────────────────────────────────────────────────────

const DEGREE_LEVELS = [
  { value: "undergraduate", label: "Bachelor's / Undergraduate", icon: "🎓" },
  { value: "masters", label: "Master's", icon: "📚" },
  { value: "phd", label: "PhD / Doctoral", icon: "🔬" },
  { value: "postdoc", label: "Postdoctoral", icon: "🧪" },
  { value: "other", label: "Other / Not sure", icon: "❓" },
];

const COUNTRIES = [
  { value: "Germany", flag: "🇩🇪" },
  { value: "Turkey", flag: "🇹🇷" },
  { value: "South Korea", flag: "🇰🇷" },
  { value: "European Union", flag: "🇪🇺" },
  { value: "United States", flag: "🇺🇸" },
  { value: "United Kingdom", flag: "🇬🇧" },
  { value: "Canada", flag: "🇨🇦" },
  { value: "Australia", flag: "🇦🇺" },
  { value: "Japan", flag: "🇯🇵" },
  { value: "France", flag: "🇫🇷" },
  { value: "Netherlands", flag: "🇳🇱" },
  { value: "Sweden", flag: "🇸🇪" },
];

const FIELDS_OF_STUDY = [
  "Computer Science / IT",
  "Engineering",
  "Medicine / Health Sciences",
  "Business / Economics",
  "Arts & Humanities",
  "Social Sciences",
  "Law",
  "Natural Sciences",
  "Education",
  "Other",
];

const TOTAL_STEPS = 4;

// ── Step sub-components ───────────────────────────────────────

function StepDegree({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-3">
      {DEGREE_LEVELS.map((d) => (
        <button key={d.value} type="button" onClick={() => onChange(d.value)}
          className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 text-left transition-all duration-200
            ${value === d.value ? "border-teal bg-teal/5 text-navy font-medium" : "border-border bg-white hover:border-navy/20 hover:bg-surface-raised text-text-secondary"}`}>
          <span className="text-2xl">{d.icon}</span>
          <span className="text-sm">{d.label}</span>
          {value === d.value && (
            <svg className="w-4 h-4 text-teal ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}

function StepCountries({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  function toggle(country: string) {
    onChange(selected.includes(country) ? selected.filter(c => c !== country) : [...selected, country]);
  }
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {COUNTRIES.map((c) => {
        const on = selected.includes(c.value);
        return (
          <button key={c.value} type="button" onClick={() => toggle(c.value)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all duration-200
              ${on ? "border-teal bg-teal/5 text-navy font-medium" : "border-border bg-white hover:border-navy/20 text-text-secondary"}`}>
            <span className="text-xl">{c.flag}</span>
            <span className="text-sm leading-tight flex-1">{c.value}</span>
            {on && (
              <div className="w-4 h-4 rounded-full bg-teal flex items-center justify-center shrink-0">
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function StepField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {FIELDS_OF_STUDY.map((field) => (
        <button key={field} type="button" onClick={() => onChange(field)}
          className={`px-4 py-3 rounded-xl border-2 text-sm text-left transition-all duration-200
            ${value === field ? "border-teal bg-teal/5 text-navy font-medium" : "border-border bg-white hover:border-navy/20 text-text-secondary"}`}>
          {field}
        </button>
      ))}
    </div>
  );
}

function StepFunding({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="space-y-4">
      {[
        { v: true, label: "Yes — I need full funding", sub: "Tuition + living stipend covered", icon: "💰" },
        { v: false, label: "No — partial funding is fine", sub: "I can cover some costs myself", icon: "🎯" },
      ].map((opt) => (
        <button key={String(opt.v)} type="button" onClick={() => onChange(opt.v)}
          className={`w-full flex items-center gap-4 px-6 py-5 rounded-xl border-2 text-left transition-all duration-200
            ${value === opt.v ? "border-teal bg-teal/5 text-navy" : "border-border bg-white hover:border-navy/20 text-text-secondary"}`}>
          <span className="text-3xl">{opt.icon}</span>
          <div>
            <p className="text-sm font-semibold">{opt.label}</p>
            <p className="text-xs text-text-muted mt-0.5">{opt.sub}</p>
          </div>
          {value === opt.v && (
            <svg className="w-5 h-5 text-teal ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────

interface FormState {
  degree_level: string;
  countries_of_interest: string[];
  field_of_study: string;
  needs_full_funding: boolean | null;
}

function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormState>({
    degree_level: "",
    countries_of_interest: [],
    field_of_study: "",
    needs_full_funding: null,
  });

  const stepMeta = [
    { title: "What level are you studying at?", subtitle: "We'll match scholarships to your degree level." },
    { title: "Which countries interest you?", subtitle: "Select all that apply — you can change this later." },
    { title: "What's your field of study?", subtitle: "We'll surface the most relevant opportunities." },
    { title: "Do you need full funding?", subtitle: "This helps us filter scholarships by funding type." },
  ];

  function canAdvance() {
    if (step === 1) return !!form.degree_level;
    if (step === 2) return form.countries_of_interest.length > 0;
    if (step === 3) return !!form.field_of_study;
    if (step === 4) return form.needs_full_funding !== null;
    return false;
  }

  async function handleNext() {
    if (step < TOTAL_STEPS) { setStep(s => s + 1); return; }
    setSaving(true);
    setError("");
    try {
      await updateMyProfile({
        degree_level: form.degree_level,
        countries_of_interest: form.countries_of_interest,
        field_of_study: form.field_of_study,
        needs_full_funding: form.needs_full_funding!,
      });
      router.replace("/dashboard");
    } catch {
      setError("Failed to save. Please try again.");
      setSaving(false);
    }
  }

  const { title, subtitle } = stepMeta[step - 1];

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-navy to-teal mb-4">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l6.16-3.422A12.083 12.083 0 0121 21H3a12.083 12.083 0 012.84-10.422L12 14z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-navy">Let&apos;s personalise Bursarly</h1>
          <p className="text-text-secondary text-sm mt-1">4 quick questions to surface the best scholarships for you</p>
        </motion.div>

        {/* Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-[var(--shadow-lg)] border border-border/60 overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-border">
            <motion.div className="h-full bg-gradient-to-r from-navy to-teal"
              animate={{ width: `${((step - 1) / TOTAL_STEPS) * 100}%` }}
              transition={{ duration: 0.4, ease: "easeInOut" }} />
          </div>

          <div className="p-6 sm:p-8">
            {/* Step dots */}
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-medium text-text-muted">Step {step} of {TOTAL_STEPS}</span>
              <div className="flex gap-1.5">
                {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i < step ? "bg-teal w-6" : "bg-border w-3"}`} />
                ))}
              </div>
            </div>

            {/* Step content */}
            <AnimatePresence mode="wait">
              <motion.div key={step}
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.22 }}>
                <h2 className="text-xl font-bold text-navy mb-1">{title}</h2>
                <p className="text-text-secondary text-sm mb-6">{subtitle}</p>

                {step === 1 && <StepDegree value={form.degree_level} onChange={v => setForm(f => ({ ...f, degree_level: v }))} />}
                {step === 2 && <StepCountries selected={form.countries_of_interest} onChange={v => setForm(f => ({ ...f, countries_of_interest: v }))} />}
                {step === 3 && <StepField value={form.field_of_study} onChange={v => setForm(f => ({ ...f, field_of_study: v }))} />}
                {step === 4 && <StepFunding value={form.needs_full_funding} onChange={v => setForm(f => ({ ...f, needs_full_funding: v }))} />}
              </motion.div>
            </AnimatePresence>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="mt-4 text-sm text-deadline-urgent font-medium" role="alert">
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Nav */}
            <div className="flex items-center justify-between mt-8 pt-5 border-t border-border/50">
              <button type="button"
                onClick={step === 1 ? () => router.replace("/dashboard") : () => setStep(s => s - 1)}
                className="text-sm text-text-muted hover:text-navy transition-colors">
                {step === 1 ? "Skip for now" : "← Back"}
              </button>
              <motion.button type="button" onClick={handleNext}
                disabled={!canAdvance() || saving}
                whileTap={{ scale: 0.97 }}
                id={`onboarding-step-${step}-next`}
                className="px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-navy to-teal hover:from-navy-light hover:to-teal-light disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-sm">
                {saving
                  ? <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Saving…
                    </span>
                  : step === TOTAL_STEPS ? "Finish setup →" : "Continue →"}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <AuthGuard>
      <PageTransition>
        <OnboardingWizard />
      </PageTransition>
    </AuthGuard>
  );
}
