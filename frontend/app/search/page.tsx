"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { searchScholarships, type ScholarshipListItem } from "@/app/lib/api";
import ScholarshipCard from "@/app/components/ScholarshipCard";
import SkeletonCard from "@/app/components/SkeletonCard";
import SearchBar from "@/app/components/SearchBar";
import PageTransition from "@/app/components/PageTransition";
import Link from "next/link";

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";

  const [results, setResults] = useState<ScholarshipListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    const doSearch = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await searchScholarships(query);
        setResults(data);
        setSearched(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setLoading(false);
      }
    };

    doSearch();
  }, [query]);

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/browse"
            className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-teal mb-4 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Browse
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-navy mb-2">
            Search Results
          </h1>
          {query && (
            <p className="text-text-secondary text-sm">
              Showing results for &ldquo;<span className="font-medium text-navy">{query}</span>&rdquo;
            </p>
          )}
        </div>

        {/* Search bar for refining */}
        <div className="mb-8 max-w-xl">
          <SearchBar variant="compact" defaultQuery={query} />
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="bg-deadline-urgent/5 border border-deadline-urgent/20 rounded-xl p-6 max-w-md mx-auto">
              <p className="text-deadline-urgent font-medium text-sm mb-2">Search failed</p>
              <p className="text-text-secondary text-xs">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Results grid */}
        {!error && (
          <>
            {!loading && searched && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-text-muted mb-4"
              >
                {results.length} result{results.length !== 1 ? "s" : ""} found
              </motion.p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {loading ? (
                <SkeletonCard count={3} />
              ) : results.length === 0 && searched ? (
                <div className="col-span-full text-center py-16">
                  <div className="text-4xl mb-3">🔍</div>
                  <p className="text-text-secondary text-sm font-medium mb-1">
                    No scholarships found
                  </p>
                  <p className="text-text-muted text-xs mb-4">
                    Try a different search term or browse all scholarships
                  </p>
                  <Link
                    href="/browse"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-navy text-white text-xs font-medium rounded-lg hover:bg-navy-light transition-colors"
                  >
                    Browse All
                  </Link>
                </div>
              ) : !searched ? (
                <div className="col-span-full text-center py-16">
                  <div className="text-4xl mb-3">✨</div>
                  <p className="text-text-secondary text-sm">
                    Enter a search term to find scholarships
                  </p>
                </div>
              ) : (
                results.map((s, i) => (
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

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="skeleton h-8 w-48 mb-4 rounded" />
          <div className="skeleton h-11 w-full max-w-md mb-8 rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <SkeletonCard count={3} />
          </div>
        </div>
      }
    >
      <SearchResults />
    </Suspense>
  );
}
