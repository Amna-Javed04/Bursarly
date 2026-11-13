"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ScholarshipListItem } from "@/app/lib/api";
import SpotlightCard from "@/app/components/motion/SpotlightCard";
import VerificationBadge from "@/app/components/VerificationBadge";
import {
  getDeadlineUrgency,
  getUrgencyClasses,
  formatDeadlineDate,
  formatDaysRemaining,
  getCountryFlag,
  formatFundingType,
} from "@/app/lib/utils";

interface ScholarshipCardProps {
  scholarship: ScholarshipListItem;
  index?: number;
}

export default function ScholarshipCard({ scholarship, index = 0 }: ScholarshipCardProps) {
  const hasDeadline = !!scholarship.nearest_deadline;
  const urgency = hasDeadline ? getDeadlineUrgency(scholarship.nearest_deadline!) : null;
  const urgencyClasses = urgency ? getUrgencyClasses(urgency) : null;
  const isUrgent = urgency === "urgent";

  return (
    <motion.div
      initial={{ opacity: 0, y: 22, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{
        duration: 0.7,
        delay: Math.min(index * 0.06, 0.4),
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <Link
        href={`/scholarship/${scholarship.id}`}
        className="group block h-full"
        id={`scholarship-card-${scholarship.id}`}
      >
        <SpotlightCard
          className="ring-gradient h-full rounded-[22px] border border-border/60 bg-surface
            shadow-[var(--shadow-card)] transition-all duration-500
            group-hover:-translate-y-1 group-hover:border-transparent
            group-hover:shadow-[0_28px_60px_-30px_rgba(5,8,15,0.38)]"
        >
          <div className="flex h-full flex-col p-5 sm:p-6">
            {/* Title + flag */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="text-[15.5px] font-semibold text-navy leading-snug tracking-[-0.01em] line-clamp-2
                group-hover:text-jade-deep transition-colors duration-300">
                {scholarship.name}
              </h3>
              <span
                className="grid place-items-center w-9 h-9 shrink-0 rounded-full bg-surface-raised text-lg
                  ring-1 ring-black/[0.04] transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6"
                aria-label={scholarship.country}
              >
                {getCountryFlag(scholarship.country)}
              </span>
            </div>

            {/* Verification */}
            <div className="mb-3">
              <VerificationBadge
                compact
                sourceCheck={scholarship.source_check}
                hasConfirmedDeadline={hasDeadline}
              />
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-1.5 mb-5">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-navy/[0.045] text-navy/75">
                {scholarship.country}
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-jade/10 text-jade-deep">
                {formatFundingType(scholarship.funding_type)}
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-surface-raised text-text-secondary ring-1 ring-black/[0.04]">
                {scholarship.degree_level}
              </span>
            </div>

            {/* Deadline */}
            <div className="mt-auto flex items-end justify-between gap-3 pt-4 border-t border-border/50">
              {hasDeadline && urgencyClasses ? (
                <>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${urgencyClasses.dot} ${isUrgent ? "pulse-dot" : ""}`}
                    />
                    <span className={`text-xs font-semibold ${urgencyClasses.text}`}>
                      {formatDaysRemaining(scholarship.nearest_deadline!)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-text-muted tabular-nums">
                      {formatDeadlineDate(scholarship.nearest_deadline!)}
                    </span>
                    <svg
                      className="w-4 h-4 text-text-muted opacity-0 -translate-x-1 transition-all duration-500
                        group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-jade-deep"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-text-muted/50" />
                    <span className="text-xs text-text-secondary">Deadline varies by track</span>
                  </div>
                  <span className="text-[11px] text-text-muted">Check official page</span>
                </>
              )}
            </div>
          </div>
        </SpotlightCard>
      </Link>
    </motion.div>
  );
}
