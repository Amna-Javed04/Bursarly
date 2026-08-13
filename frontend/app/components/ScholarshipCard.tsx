"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ScholarshipListItem } from "@/app/lib/api";
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay: index * 0.06,
        ease: [0.25, 0.46, 0.45, 0.94] as const,
      }}
    >
      <Link
        href={`/scholarship/${scholarship.id}`}
        className="group block"
        id={`scholarship-card-${scholarship.id}`}
      >
        <div
          className="relative bg-surface rounded-2xl p-5 sm:p-6 border border-border/60
            shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)]
            hover:border-teal/30 transition-all duration-300
            hover:-translate-y-0.5"
        >
          {/* Country flag accent */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-navy leading-snug group-hover:text-teal-dark transition-colors duration-200 line-clamp-2">
                {scholarship.name}
              </h3>
            </div>
            <span className="text-xl flex-shrink-0" aria-label={scholarship.country}>
              {getCountryFlag(scholarship.country)}
            </span>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-navy/5 text-navy/80">
              {scholarship.country}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-teal/8 text-teal-dark">
              {formatFundingType(scholarship.funding_type)}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-surface-raised text-text-secondary">
              {scholarship.degree_level}
            </span>
          </div>

          {/* Deadline section */}
          <div className="flex items-center justify-between pt-3 border-t border-border/40">
            {hasDeadline && urgencyClasses ? (
              <>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${urgencyClasses.dot}`} />
                  <span className={`text-xs font-medium ${urgencyClasses.text}`}>
                    {formatDaysRemaining(scholarship.nearest_deadline!)}
                  </span>
                </div>
                <span className="text-xs text-text-muted">
                  {formatDeadlineDate(scholarship.nearest_deadline!)}
                </span>
              </>
            ) : (
              <span className="text-xs text-text-muted">No upcoming deadline</span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
