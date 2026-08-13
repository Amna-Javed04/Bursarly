"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getScholarships, getMyProfile, type ScholarshipListItem } from "@/app/lib/api";
import ScholarshipCard from "@/app/components/ScholarshipCard";
import SkeletonCard from "@/app/components/SkeletonCard";
import SearchBar from "@/app/components/SearchBar";
import PageTransition from "@/app/components/PageTransition";
import { useAuth } from "@/app/context/AuthContext";

const COUNTRIES = [
  "Germany",
  "Turkey",
  "South Korea",
  "European Union",
];

export default function BrowsePage() {
  const { user } = useAuth();
  const [scholarships, setScholarships] = useState<ScholarshipListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [usingPrefs, setUsingPrefs] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Load user preferences on first render and pre-populate country filter
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const profile = await getMyProfile();
        if (profile.countries_of_interest?.length) {
          setSelectedCountries(new Set(profile.countries_of_interest));
          setUsingPrefs(true);
        }
      } catch { /* profile not set yet — no-op */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchScholarships = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // If multiple countries are selected, we fetch each and merge
      if (selectedCountries.size === 0) {
        const data = await getScholarships();
        setScholarships(data);
      } else if (selectedCountries.size === 1) {
        const country = Array.from(selectedCountries)[0];
        const data = await getScholarships({ country });
        setScholarships(data);
      } else {
        // Fetch for each selected country in parallel
        const promises = Array.from(selectedCountries).map((country) =>
          getScholarships({ country })
        );
        const results = await Promise.all(promises);
        const merged = results.flat();
        // Deduplicate by id
        const seen = new Set<string>();
        const unique = merged.filter((s) => {
          if (seen.has(s.id)) return false;
          seen.add(s.id);
          return true;
        });
        setScholarships(unique);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scholarships");
    } finally {
      setLoading(false);
    }
  }, [selectedCountries]);

  useEffect(() => {
    fetchScholarships();
  }, [fetchScholarships]);

  // Close filter dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleCountry = (country: string) => {
    setSelectedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(country)) {
        next.delete(country);
      } else {
        next.add(country);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setSelectedCountries(new Set());
    setUsingPrefs(false);
  };

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-navy mb-2">
            Browse Scholarships
          </h1>
          <p className="text-text-secondary text-sm sm:text-base">
            Explore verified scholarship opportunities worldwide
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
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-teal/5 border border-teal/20">
                <div className="flex items-center gap-2 text-sm text-teal-dark">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="font-medium">Filtered by your preferences</span>
                  <span className="text-teal/70">&mdash; showing scholarships for your saved countries</span>
                </div>
                <button onClick={clearFilters} className="text-xs text-text-muted hover:text-navy transition-colors shrink-0">
                  Clear
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-8">
          {/* Country Filter */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border
                text-sm font-medium transition-all duration-200
                ${selectedCountries.size > 0
                  ? "border-teal/40 bg-teal/5 text-teal-dark"
                  : "border-border bg-surface text-text-secondary hover:border-border-light"
                }`}
              id="filter-country-toggle"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Country
              {selectedCountries.size > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-teal text-white text-xs font-bold">
                  {selectedCountries.size}
                </span>
              )}
              <svg className={`w-3.5 h-3.5 transition-transform ${filterOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown */}
            <AnimatePresence>
              {filterOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-2 w-64 bg-surface rounded-xl border border-border
                    shadow-[var(--shadow-lg)] z-20 overflow-hidden"
                  id="filter-country-dropdown"
                >
                  <div className="p-2 space-y-0.5">
                    {COUNTRIES.map((country) => {
                      const isSelected = selectedCountries.has(country);
                      return (
                        <button
                          key={country}
                          onClick={() => toggleCountry(country)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                            transition-colors duration-150 text-left
                            ${isSelected
                              ? "bg-teal/8 text-teal-dark font-medium"
                              : "text-text-primary hover:bg-surface-raised"
                            }`}
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
                            ${isSelected ? "bg-teal border-teal" : "border-border"}`}
                          >
                            {isSelected && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          {country}
                        </button>
                      );
                    })}
                  </div>
                  {selectedCountries.size > 0 && (
                    <div className="border-t border-border/50 p-2">
                      <button
                        onClick={clearFilters}
                        className="w-full text-xs text-text-muted hover:text-deadline-urgent text-center py-1.5 transition-colors"
                      >
                        Clear all filters
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Active filter pills */}
          <AnimatePresence>
            {Array.from(selectedCountries).map((country) => (
              <motion.button
                key={country}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => toggleCountry(country)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                  bg-navy/5 text-navy text-xs font-medium hover:bg-navy/10 transition-colors"
              >
                {country}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>
            ))}
          </AnimatePresence>

          {/* Spacer + Search */}
          <div className="sm:ml-auto w-full sm:w-auto">
            <SearchBar variant="compact" />
          </div>
        </div>

        {/* Results */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="bg-deadline-urgent/5 border border-deadline-urgent/20 rounded-xl p-6 max-w-md mx-auto">
              <p className="text-deadline-urgent font-medium text-sm mb-2">Something went wrong</p>
              <p className="text-text-secondary text-xs">{error}</p>
              <button
                onClick={fetchScholarships}
                className="mt-4 px-4 py-2 bg-navy text-white text-xs font-medium rounded-lg hover:bg-navy-light transition-colors"
              >
                Try again
              </button>
            </div>
          </motion.div>
        )}

        {!error && (
          <>
            {/* Result count */}
            {!loading && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-text-muted mb-4"
              >
                {scholarships.length} scholarship{scholarships.length !== 1 ? "s" : ""} found
              </motion.p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {loading ? (
                <SkeletonCard count={6} />
              ) : scholarships.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <p className="text-text-muted text-sm">
                    No scholarships found with the current filters.
                  </p>
                  <button
                    onClick={clearFilters}
                    className="mt-3 text-teal text-sm font-medium hover:underline"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                scholarships.map((s, i) => (
                  <ScholarshipCard key={s.id} scholarship={s} index={i} />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </PageTransition>
  );
}
