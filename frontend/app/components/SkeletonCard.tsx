"use client";

import { motion } from "framer-motion";

interface SkeletonCardProps {
  count?: number;
}

function SingleSkeleton({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05 }}
      className="bg-surface rounded-2xl p-5 sm:p-6 border border-border/40"
    >
      {/* Title area */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-3/4 rounded" />
          <div className="skeleton h-4 w-1/2 rounded" />
        </div>
        <div className="skeleton w-8 h-8 rounded-full flex-shrink-0" />
      </div>

      {/* Tags */}
      <div className="flex gap-2 mb-4">
        <div className="skeleton h-6 w-20 rounded-md" />
        <div className="skeleton h-6 w-24 rounded-md" />
        <div className="skeleton h-6 w-16 rounded-md" />
      </div>

      {/* Deadline */}
      <div className="flex items-center justify-between pt-3 border-t border-border/40">
        <div className="skeleton h-3 w-24 rounded" />
        <div className="skeleton h-3 w-20 rounded" />
      </div>
    </motion.div>
  );
}

export default function SkeletonCard({ count = 6 }: SkeletonCardProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SingleSkeleton key={i} index={i} />
      ))}
    </>
  );
}
