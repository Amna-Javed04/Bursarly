interface VerificationBadgeProps {
  /** Result of checking the official page. */
  sourceCheck?: "verified" | "blocked" | "unreachable" | "not_checked" | string;
  /** True when at least one deadline was confirmed on the official page. */
  hasConfirmedDeadline?: boolean;
  /** Compact variant for cards. */
  compact?: boolean;
}

/**
 * Everything Bursarly shows about a deadline is graded. This badge makes the
 * grade visible instead of implying every date is equally trustworthy.
 */
export default function VerificationBadge({
  sourceCheck,
  hasConfirmedDeadline = false,
  compact = false,
}: VerificationBadgeProps) {
  let label: string;
  let tone: string;
  let dot: string;
  let title: string;

  if (sourceCheck === "verified" && hasConfirmedDeadline) {
    label = compact ? "Official date" : "Deadline confirmed on the official page";
    tone = "text-deadline-safe bg-deadline-safe/10 border-deadline-safe/25";
    dot = "bg-deadline-safe";
    title = "This date was found on the scholarship's official page.";
  } else if (sourceCheck === "verified") {
    label = compact ? "Official source" : "Official page reachable · date varies by track";
    tone = "text-teal-dark bg-teal/10 border-teal/25";
    dot = "bg-teal";
    title = "The official page is reachable, but it publishes no single date for this programme.";
  } else if (sourceCheck === "blocked") {
    label = compact ? "Check the source" : "Official page could not be read automatically";
    tone = "text-deadline-warning bg-deadline-warning/10 border-deadline-warning/25";
    dot = "bg-deadline-warning";
    title = "The official site blocked automated checking. Verify dates and documents on the official page.";
  } else {
    label = compact ? "Unverified" : "Source not verified yet";
    tone = "text-text-secondary bg-surface-raised border-border";
    dot = "bg-text-muted";
    title = "Bursarly has not verified this record against an official page.";
  }

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium
        ${compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"}
        ${tone}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
