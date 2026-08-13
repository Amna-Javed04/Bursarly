"use client";

import { useState, useEffect, use } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getScholarshipById, addToTracker, type ScholarshipDetail } from "@/app/lib/api";
import {
  getDeadlineUrgency, getUrgencyClasses, formatDeadlineDate,
  formatDaysRemaining, getCountryFlag, formatFundingType, formatHelpCategory,
} from "@/app/lib/utils";
import PageTransition from "@/app/components/PageTransition";
import { useAuth } from "@/app/context/AuthContext";

const RESOURCE_CATEGORIES = [
  { key: "essay_help", icon: "📝" },
  { key: "recommendation_letter", icon: "✉️" },
  { key: "application_process", icon: "📋" },
  { key: "interview_prep", icon: "🎤" },
] as const;

function DetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="skeleton h-4 w-24 mb-6 rounded" />
      <div className="skeleton h-8 w-3/4 mb-3 rounded" />
      <div className="skeleton h-4 w-1/2 mb-8 rounded" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[1,2,3].map(i=><div key={i} className="skeleton h-24 rounded-xl"/>)}
      </div>
      <div className="skeleton h-48 rounded-xl mb-6" />
      <div className="skeleton h-32 rounded-xl" />
    </div>
  );
}

// ── Tracker button states ─────────────────────────────────────
type TrackerState = "idle" | "loading" | "added" | "error";

export default function ScholarshipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [scholarship, setScholarship] = useState<ScholarshipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("essay_help");

  // Tracker state
  const [trackerState, setTrackerState] = useState<TrackerState>("idle");
  const [trackerError, setTrackerError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await getScholarshipById(id);
        setScholarship(data);
        const firstCat = data.resources.length > 0 ? data.resources[0].help_category : "essay_help";
        setActiveTab(firstCat);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleAddToTracker() {
    // Not logged in → redirect to signup with return path
    if (!user) {
      router.push(`/signup?next=/scholarship/${id}`);
      return;
    }
    // Email not verified → redirect to login which will show the gate
    if (!user.email_confirmed_at) {
      router.push(`/login?next=/scholarship/${id}`);
      return;
    }

    setTrackerState("loading");
    setTrackerError("");
    try {
      await addToTracker(id);
      setTrackerState("added");
    } catch (err: unknown) {
      setTrackerState("error");
      setTrackerError(err instanceof Error ? err.message : "Failed to add");
    }
  }

  if (loading) return <DetailSkeleton />;

  if (error || !scholarship) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-deadline-urgent font-medium mb-2">Scholarship not found</p>
        <p className="text-text-secondary text-sm mb-4">{error}</p>
        <Link href="/browse" className="text-teal text-sm font-medium hover:underline">← Back to Browse</Link>
      </div>
    );
  }

  const futureDeadlines = scholarship.deadlines
    .filter((d) => new Date(d.deadline_date) >= new Date(new Date().toDateString()))
    .sort((a, b) => new Date(a.deadline_date).getTime() - new Date(b.deadline_date).getTime());

  const filteredResources = scholarship.resources.filter((r) => r.help_category === activeTab);
  const availableCategories = RESOURCE_CATEGORIES.filter((c) =>
    scholarship.resources.some((r) => r.help_category === c.key)
  );

  // Tracker button content
  const isVerifiedUser = !!user && !!user.email_confirmed_at;
  const buttonContent = () => {
    if (authLoading) return <span className="flex items-center gap-2"><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Loading…</span>;
    if (trackerState === "loading") return <span className="flex items-center gap-2"><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Adding…</span>;
    if (trackerState === "added") return <span className="flex items-center gap-2"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>Added to Tracker!</span>;
    if (!user) return <span className="flex items-center gap-2"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>Sign up to Track</span>;
    return <span className="flex items-center gap-2"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>Add to My Tracker</span>;
  };

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Breadcrumb */}
        <Link href="/browse" className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-teal mb-6 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          Back to Browse
        </Link>

        {/* Title + tracker button */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{getCountryFlag(scholarship.country)}</span>
              <span className="text-xs font-medium text-text-muted bg-surface-raised px-2 py-1 rounded-md">{scholarship.country}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-navy leading-tight mb-2">{scholarship.name}</h1>
            <div className="flex flex-wrap gap-2">
              <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-teal/8 text-teal-dark">{formatFundingType(scholarship.funding_type)}</span>
              <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-navy/5 text-navy/80">{scholarship.degree_level}</span>
            </div>
          </div>

          {/* Tracker button */}
          <div className="flex flex-col items-start sm:items-end gap-2">
            <motion.button
              onClick={handleAddToTracker}
              disabled={trackerState === "loading" || trackerState === "added" || authLoading}
              whileTap={{ scale: 0.97 }}
              id="add-to-tracker-btn"
              className={`inline-flex items-center gap-2 px-5 py-2.5 font-semibold text-sm rounded-xl
                shadow-[var(--shadow-md)] transition-all duration-200 flex-shrink-0
                ${trackerState === "added"
                  ? "bg-deadline-safe text-white cursor-default"
                  : "bg-teal text-white hover:bg-teal-dark active:scale-[0.97]"
                }
                disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {buttonContent()}
            </motion.button>

            {/* Link to dashboard if added */}
            <AnimatePresence>
              {trackerState === "added" && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <Link href="/dashboard" className="text-xs text-teal hover:text-teal-dark font-medium transition-colors">
                    View in Dashboard →
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            <AnimatePresence>
              {trackerState === "error" && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-xs text-deadline-urgent">
                  {trackerError || "Failed to add. Try again."}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Sign-in nudge for guests */}
            {!authLoading && !user && (
              <p className="text-xs text-text-muted">
                Or{" "}
                <Link href={`/login?next=/scholarship/${id}`} className="text-teal hover:underline">
                  log in
                </Link>{" "}
                to your existing account
              </p>
            )}
          </div>
        </div>

        {/* Info Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {/* Deadlines */}
          <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:0.1}}
            className="bg-surface rounded-xl p-5 border border-border/50 shadow-[var(--shadow-card)]">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Deadlines</h3>
            {futureDeadlines.length > 0 ? (
              <div className="space-y-2.5">
                {futureDeadlines.map((d) => {
                  const urgency = getDeadlineUrgency(d.deadline_date);
                  const classes = getUrgencyClasses(urgency);
                  return (
                    <div key={d.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${classes.dot}`} />
                        <span className="text-sm font-medium text-text-primary">{formatDeadlineDate(d.deadline_date)}</span>
                      </div>
                      <span className={`text-xs font-medium ${classes.text}`}>{formatDaysRemaining(d.deadline_date)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-text-muted">No upcoming deadlines</p>
            )}
          </motion.div>

          {/* Eligibility */}
          <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:0.2}}
            className="bg-surface rounded-xl p-5 border border-border/50 shadow-[var(--shadow-card)]">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Eligibility</h3>
            {scholarship.eligibility.length > 0 ? (
              <ul className="space-y-2">
                {scholarship.eligibility.map((e) => (
                  <li key={e.id} className="flex items-start gap-2 text-sm text-text-secondary">
                    <svg className="w-4 h-4 text-teal flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                    </svg>
                    {e.criteria_text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">No eligibility info available</p>
            )}
          </motion.div>

          {/* Documents */}
          <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:0.3}}
            className="bg-surface rounded-xl p-5 border border-border/50 shadow-[var(--shadow-card)]">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Required Documents</h3>
            {scholarship.documents.length > 0 ? (
              <ul className="space-y-2">
                {scholarship.documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 text-sm text-text-secondary">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${d.is_required ? "bg-deadline-urgent" : "bg-text-muted"}`} />
                    {d.document_name}
                    {!d.is_required && <span className="text-xs text-text-muted">(optional)</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">No document info available</p>
            )}
          </motion.div>
        </div>

        {/* Official URL */}
        {scholarship.official_url && (
          <div className="mb-8">
            <a href={scholarship.official_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-surface text-sm font-medium text-navy hover:border-teal/40 hover:bg-teal/5 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
              Visit Official Website
            </a>
          </div>
        )}

        {/* Help & Resources Tabs */}
        {scholarship.resources.length > 0 && (
          <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:0.4}}>
            <h2 className="text-xl font-bold text-navy mb-4">Help & Resources</h2>
            <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
              {availableCategories.map((cat) => (
                <button key={cat.key} onClick={() => setActiveTab(cat.key)}
                  className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                    ${activeTab === cat.key ? "text-navy bg-surface shadow-[var(--shadow-sm)] border border-border/50" : "text-text-secondary hover:text-navy hover:bg-surface-raised"}`}>
                  <span>{cat.icon}</span>
                  {formatHelpCategory(cat.key)}
                  {activeTab === cat.key && (
                    <motion.div layoutId="resource-tab" className="absolute bottom-0 left-3 right-3 h-0.5 bg-teal rounded-full" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                  )}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }} className="space-y-3">
                {filteredResources.map((r) => (
                  <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"
                    className="group flex items-start gap-3 p-4 rounded-xl bg-surface border border-border/50 hover:border-teal/30 hover:shadow-[var(--shadow-card-hover)] transition-all duration-200">
                    <div className="w-8 h-8 rounded-lg bg-navy/5 flex items-center justify-center flex-shrink-0 text-xs">
                      {r.resource_type === "youtube_video" ? "🎥" : r.resource_type === "article" ? "📄" : r.resource_type === "institute" ? "🏛" : "💼"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-navy group-hover:text-teal-dark transition-colors">{r.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-text-muted capitalize">{r.resource_type.replace("_", " ")}</span>
                        {r.is_free && <span className="text-xs font-medium text-deadline-safe bg-deadline-safe/10 px-1.5 py-0.5 rounded">Free</span>}
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-text-muted group-hover:text-teal flex-shrink-0 mt-1 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                    </svg>
                  </a>
                ))}
                {filteredResources.length === 0 && (
                  <p className="text-sm text-text-muted text-center py-8">No resources in this category yet.</p>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
}
