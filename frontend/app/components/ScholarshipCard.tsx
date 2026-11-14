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
  /** Wider, taller treatment used for the lead card in a group. */
  featured?: boolean;
}

const CLAY_TONES = ["clay-pink", "clay-lilac", "clay-peach"];

export default function ScholarshipCard({
  scholarship,
  index = 0,
  featured = false,
}: ScholarshipCardProps) {
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
          className={`clay clay-hover h-full ${CLAY_TONES[index % CLAY_TONES.length]}
            ${featured ? "p-6 sm:p-8" : "p-5 sm:p-6"}`}
        >
          <div className={`flex h-full flex-col ${featured ? "sm:max-w-[46rem]" : ""}`}>
            {/* Title + flag */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className={`font-semibold text-navy leading-snug tracking-[-0.02em] line-clamp-2
                group-hover:text-teal-dark transition-colors duration-300
                ${featured ? "text-[21px] sm:text-[23px]" : "text-[15.5px]"}`}>
                {scholarship.name}
              </h3>
              <span
                className="grid place-items-center w-10 h-10 shrink-0 bg-white/70 text-lg
                  ring-1 ring-black/[0.05] transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-3"
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
              <span className="inline-flex items-center px-2 py-1 text-[11px] font-medium bg-white/55 text-navy/75">
                {scholarship.country}
              </span>
              <span className="inline-flex items-center px-2 py-1 text-[11px] font-medium bg-white/55 text-teal-dark">
                {formatFundingType(scholarship.funding_type)}
              </span>
              <span className="inline-flex items-center px-2 py-1 text-[11px] font-medium bg-white/40 text-text-secondary">
                {scholarship.degree_level}
              </span>
            </div>

            {/* Deadline */}
            <div className="mt-auto flex items-end justify-between gap-3 pt-4 border-t border-navy/10">
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
