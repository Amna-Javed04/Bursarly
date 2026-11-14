"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getScholarships, getMyProfile, type ScholarshipListItem } from "@/app/lib/api";
import ScholarshipCard from "@/app/components/ScholarshipCard";
import SkeletonCard from "@/app/components/SkeletonCard";
import SearchBar from "@/app/components/SearchBar";
import PageTransition from "@/app/components/PageTransition";
import { useAuth } from "@/app/context/AuthContext";

const DEGREE_BUCKETS = [
  { key: "undergraduate", label: "Undergraduate", match: /bachelor|undergraduate/i },
  { key: "masters", label: "Master's", match: /master|graduate|postgraduate/i },
  { key: "phd", label: "PhD", match: /phd|dphil|doctor/i },
  { key: "fellowship", label: "Fellowship", match: /fellowship/i },
];

interface DropdownProps {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  onClear: () => void;
  id: string;
}

function FilterDropdown({ label, options, selected, onToggle, onClear, id }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        id={`filter-${id}-toggle`}
        className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] font-medium transition-all duration-300
          ${selected.size > 0
            ? "border-teal/40 bg-teal/5 text-teal-dark"
            : "border-border bg-surface text-text-secondary hover:border-border-light"
          }`}
      >
        {label}
        {selected.size > 0 && (
          <span className="ml-0.5 rounded-full bg-teal px-1.5 py-0.5 text-[10px] font-bold text-white">
            {selected.size}
          </span>
        )}
        <svg className={`h-3 w-3 transition-transform duration-300 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute left-0 top-full z-20 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-lg)]"
            id={`filter-${id}-dropdown`}
          >
            <div className="max-h-72 space-y-0.5 overflow-y-auto p-2">
              {options.map((option) => {
                const isSelected = selected.has(option);
                return (
                  <button
                    key={option}
                    onClick={() => onToggle(option)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] transition-colors duration-150
                      ${isSelected ? "bg-teal/10 font-medium text-teal-dark" : "text-text-primary hover:bg-surface-raised"}`}
                  >
                    <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border-2 transition-all
                      ${isSelected ? "border-teal bg-teal" : "border-border"}`}>
                      {isSelected && (
                        <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    {option}
                  </button>
                );
              })}
            </div>
            {selected.size > 0 && (
              <div className="border-t border-border/50 p-2">
                <button onClick={onClear} className="w-full py-1.5 text-center text-[11px] text-text-muted transition-colors hover:text-deadline-urgent">
                  Clear {label.toLowerCase()}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function BrowsePage() {
  const { user } = useAuth();
  const [all, setAll] = useState<ScholarshipListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [selectedDegrees, setSelectedDegrees] = useState<Set<string>>(new Set());
  const [funding, setFunding] = useState<"all" | "fully_funded" | "partially_funded">("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [usingPrefs, setUsingPrefs] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAll(await getScholarships());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scholarships");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Pre-select the countries (and degree) a signed-in user saved during onboarding.
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const profile = await getMyProfile();
        if (profile.countries_of_interest?.length) {
          setSelectedCountries(new Set(profile.countries_of_interest));
          setUsingPrefs(true);
        }
      } catch {
        /* profile not set yet — no-op */
      }
    })();
  }, [user]);

  const countries = useMemo(
    () => Array.from(new Set(all.map((s) => s.country))).sort(),
    [all]
  );

  const degreeOptions = useMemo(
    () =>
      DEGREE_BUCKETS.filter((bucket) => all.some((s) => bucket.match.test(s.degree_level))).map(
        (b) => b.label
      ),
    [all]
  );

  const results = useMemo(() => {
    return all.filter((s) => {
      if (selectedCountries.size > 0 && !selectedCountries.has(s.country)) return false;
      if (selectedDegrees.size > 0) {
        const matchesDegree = DEGREE_BUCKETS.filter((b) => b.match.test(s.degree_level)).some((b) =>
          selectedDegrees.has(b.label)
        );
        if (!matchesDegree) return false;
      }
      if (funding !== "all" && s.funding_type !== funding) return false;
      if (verifiedOnly && s.source_check !== "verified") return false;
      return true;
    });
  }, [all, selectedCountries, selectedDegrees, funding, verifiedOnly]);

  const activeFilters =
    selectedCountries.size + selectedDegrees.size + (funding !== "all" ? 1 : 0) + (verifiedOnly ? 1 : 0);

  const clearAll = () => {
    setSelectedCountries(new Set());
    setSelectedDegrees(new Set());
    setFunding("all");
    setVerifiedOnly(false);
    setUsingPrefs(false);
  };

  const toggleIn = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });

  const verifiedCount = all.filter((s) => s.source_check === "verified").length;

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {/* Header */}
        <div className="mb-7">
          <h1 className="mb-2 text-[clamp(1.75rem,3.4vw,2.4rem)] font-semibold tracking-[-0.03em] text-navy">
            Browse scholarships
          </h1>
          <p className="text-sm text-text-secondary sm:text-[15px]">
            {all.length > 0 ? `${all.length} programmes` : "Verified opportunities"} across{" "}
            {countries.length || "many"} countries · {verifiedCount} with a checkable official source
          </p>
        </div>

        {/* Preferences banner */}
        <AnimatePresence>
          {usingPrefs && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-5"
            >
              <div className="flex items-center justify-between gap-3 rounded-xl border border-teal/20 bg-teal/5 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-teal-dark">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="font-medium">Filtered by your saved preferences</span>
                </div>
                <button onClick={() => { setSelectedCountries(new Set()); setUsingPrefs(false); }} className="shrink-0 text-xs text-text-muted transition-colors hover:text-navy">
                  Clear
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter bar */}
        <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <FilterDropdown
            id="country"
            label="Country"
            options={countries}
            selected={selectedCountries}
            onToggle={(v) => toggleIn(setSelectedCountries, v)}
            onClear={() => { setSelectedCountries(new Set()); setUsingPrefs(false); }}
          />

          <FilterDropdown
            id="degree"
            label="Degree"
            options={degreeOptions}
            selected={selectedDegrees}
            onToggle={(v) => toggleIn(setSelectedDegrees, v)}
            onClear={() => setSelectedDegrees(new Set())}
          />

          <div className="inline-flex items-center border border-navy/10 bg-white/50 p-0.5">
            {([
              ["all", "All funding"],
              ["fully_funded", "Fully funded"],
              ["partially_funded", "Partial"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFunding(key)}
                className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-all duration-300
                  ${funding === key ? "bg-navy text-white shadow-sm" : "text-text-secondary hover:text-navy"}`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setVerifiedOnly((v) => !v)}
            aria-pressed={verifiedOnly}
            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[12.5px] font-medium transition-all duration-300
              ${verifiedOnly
                ? "border-jade/50 bg-jade/10 text-jade-deep"
                : "border-border bg-surface text-text-secondary hover:border-border-light"}`}
          >
            <span className={`grid h-3.5 w-3.5 place-items-center rounded-full border transition-colors
              ${verifiedOnly ? "border-jade bg-jade text-[var(--ink)]" : "border-border"}`}>
              {verifiedOnly && (
                <svg className="h-2 w-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            Official sources only
          </button>

          {activeFilters > 0 && (
            <button onClick={clearAll} className="text-xs text-text-muted underline-offset-2 transition-colors hover:text-deadline-urgent hover:underline">
              Clear all
            </button>
          )}

          <div className="w-full sm:ml-auto sm:w-auto">
            <SearchBar variant="compact" />
          </div>
        </div>

        {/* Results */}
        {error ? (
          <div className="py-12 text-center">
            <div className="mx-auto max-w-md rounded-xl border border-deadline-urgent/20 bg-deadline-urgent/5 p-6">
              <p className="mb-2 text-sm font-medium text-deadline-urgent">Something went wrong</p>
              <p className="text-xs text-text-secondary">{error}</p>
              <button onClick={load} className="mt-4 rounded-lg bg-navy px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-navy-light">
                Try again
              </button>
            </div>
          </div>
        ) : (
          <>
            {!loading && (
              <p className="mb-4 text-xs text-text-muted">
                {results.length} scholarship{results.length !== 1 ? "s" : ""} found
              </p>
            )}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-x-8">
              {loading ? (
                <SkeletonCard count={6} />
              ) : results.length === 0 ? (
                <div className="col-span-full py-14 text-center">
                  <p className="text-sm text-text-muted">No scholarships match these filters.</p>
                  <button onClick={clearAll} className="mt-3 text-sm font-medium text-teal hover:underline">
                    Clear filters
                  </button>
                </div>
              ) : (
                results.map((s, i) => {
                  const isLead = i % 5 === 0;
                  return (
                    <div
                      key={s.id}
                      className={`${isLead ? "md:col-span-2" : ""} ${i % 3 === 2 ? "md:mt-10" : ""}`}
                    >
                      <ScholarshipCard scholarship={s} index={i} featured={isLead} />
                    </div>
                  );
                })
              )}
            </div>

            {!loading && results.length > 0 && (
              <p className="mt-8 text-center text-[11px] text-text-muted">
                Deadlines marked “official date” were found on the programme’s own page.
                Everything else says so — check the official page before applying.
              </p>
            )}
          </>
        )}
      </div>
    </PageTransition>
  );
}
