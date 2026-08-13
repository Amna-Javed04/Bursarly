/**
 * Utility helpers for deadline-related calculations and formatting.
 */

/**
 * Returns the number of days remaining until a deadline.
 * Negative values mean the deadline has passed.
 */
export function daysUntilDeadline(deadlineDate: string): number {
  const deadline = new Date(deadlineDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  const diffMs = deadline.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Returns urgency level based on days remaining.
 * - "safe" (>30 days) → green
 * - "warning" (8-30 days) → amber
 * - "urgent" (1-7 days) → red
 * - "passed" (≤0 days) → gray
 */
export type UrgencyLevel = "safe" | "warning" | "urgent" | "passed";

export function getDeadlineUrgency(deadlineDate: string): UrgencyLevel {
  const days = daysUntilDeadline(deadlineDate);
  if (days <= 0) return "passed";
  if (days <= 7) return "urgent";
  if (days <= 30) return "warning";
  return "safe";
}

/**
 * Maps urgency level to Tailwind classes for text and background.
 */
export function getUrgencyClasses(urgency: UrgencyLevel): {
  text: string;
  bg: string;
  dot: string;
  border: string;
} {
  switch (urgency) {
    case "safe":
      return {
        text: "text-deadline-safe",
        bg: "bg-deadline-safe/10",
        dot: "bg-deadline-safe",
        border: "border-deadline-safe/30",
      };
    case "warning":
      return {
        text: "text-deadline-warning",
        bg: "bg-deadline-warning/10",
        dot: "bg-deadline-warning",
        border: "border-deadline-warning/30",
      };
    case "urgent":
      return {
        text: "text-deadline-urgent",
        bg: "bg-deadline-urgent/10",
        dot: "bg-deadline-urgent",
        border: "border-deadline-urgent/30",
      };
    case "passed":
      return {
        text: "text-text-muted",
        bg: "bg-border-light",
        dot: "bg-text-muted",
        border: "border-border",
      };
  }
}

/**
 * Format a deadline date into a human-readable string.
 */
export function formatDeadlineDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Friendly text for days remaining.
 */
export function formatDaysRemaining(deadlineDate: string): string {
  const days = daysUntilDeadline(deadlineDate);
  if (days <= 0) return "Deadline passed";
  if (days === 1) return "1 day left";
  if (days <= 7) return `${days} days left`;
  if (days <= 30) return `${days} days left`;
  const weeks = Math.floor(days / 7);
  if (weeks <= 8) return `${weeks} weeks left`;
  const months = Math.floor(days / 30);
  return `${months} months left`;
}

/**
 * Country flag emoji from country name (basic mapping).
 */
const COUNTRY_FLAGS: Record<string, string> = {
  Germany: "🇩🇪",
  Turkey: "🇹🇷",
  "Türkiye": "🇹🇷",
  "South Korea": "🇰🇷",
  "European Union": "🇪🇺",
  EU: "🇪🇺",
  USA: "🇺🇸",
  "United States": "🇺🇸",
  UK: "🇬🇧",
  "United Kingdom": "🇬🇧",
  Canada: "🇨🇦",
  Australia: "🇦🇺",
  Japan: "🇯🇵",
  France: "🇫🇷",
  Netherlands: "🇳🇱",
  Sweden: "🇸🇪",
  Switzerland: "🇨🇭",
  China: "🇨🇳",
};

export function getCountryFlag(country: string): string {
  return COUNTRY_FLAGS[country] || "🌍";
}

/**
 * Format funding type for display.
 */
export function formatFundingType(type: string): string {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Format help category for display.
 */
export function formatHelpCategory(category: string): string {
  const map: Record<string, string> = {
    essay_help: "Essay Help",
    recommendation_letter: "Recommendation Letters",
    application_process: "Application Process",
    interview_prep: "Interview Prep",
  };
  return map[category] || category;
}
