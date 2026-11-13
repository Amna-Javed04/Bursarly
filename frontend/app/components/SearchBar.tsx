"use client";

import { useRouter } from "next/navigation";
import { useState, FormEvent } from "react";
import { motion } from "framer-motion";

interface SearchBarProps {
  /** If true, renders a larger hero-style search bar */
  variant?: "hero" | "compact";
  /** Default query value */
  defaultQuery?: string;
  /** Optional placeholder text */
  placeholder?: string;
}

export default function SearchBar({
  variant = "compact",
  defaultQuery = "",
  placeholder = "Search scholarships by name...",
}: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultQuery);
  const [focused, setFocused] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  };

  const isHero = variant === "hero";
  const canSubmit = query.trim().length > 0;

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className={`relative w-full ${isHero ? "max-w-xl" : "max-w-md"}`}
      id="search-form"
    >
      {/* soft outer glow that blooms on focus */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -inset-[3px] rounded-[18px] bg-gradient-to-r from-teal/50 via-cobalt/40 to-gold/40 blur-lg transition-opacity duration-500
          ${focused ? "opacity-70" : "opacity-0"}`}
      />

      <div
        className={`relative flex items-center rounded-2xl transition-all duration-500
          ${isHero
            ? "h-[60px] bg-white/80 backdrop-blur-xl border border-white/70 shadow-[0_18px_44px_-30px_rgba(59,37,64,0.5)] hover:border-navy/15"
            : "h-11 bg-surface border border-border/70 hover:border-border"
          }
          ${isHero && focused ? "bg-white border-navy/20" : ""}
          ${focused ? "shadow-[0_20px_60px_-24px_rgba(194,101,139,0.45)]" : ""}`}
      >
        <div className={`flex-shrink-0 transition-colors duration-300 ${focused ? "text-teal-dark" : "text-text-muted"} ${isHero ? "pl-5" : "pl-3"}`}>
          <svg
            className={isHero ? "w-[18px] h-[18px]" : "w-4 h-4"}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className={`flex-1 bg-transparent border-none outline-none font-medium
            ${isHero
              ? "px-3 text-[15px] text-navy placeholder:text-text-muted"
              : "px-2.5 text-sm text-text-primary placeholder:text-text-muted/70"
            }`}
          id="search-input"
        />

        <button
          type="submit"
          disabled={!canSubmit}
          className={`group flex-shrink-0 inline-flex items-center gap-1.5 font-semibold rounded-xl
            transition-all duration-300 active:scale-[0.97] disabled:cursor-not-allowed
            ${isHero
              ? `mr-2 px-4 py-2.5 text-[13px] ${canSubmit
                  ? "bg-gradient-to-r from-[#C2658B] to-[#8E7BD6] text-white shadow-[0_10px_26px_-14px_rgba(194,101,139,0.8)]"
                  : "bg-navy/[0.08] text-text-muted"
                }`
              : `mr-1 px-3.5 py-1.5 text-xs ${canSubmit
                  ? "bg-navy text-white hover:bg-navy-light"
                  : "bg-navy/40 text-white/70"
                }`
            }`}
          id="search-submit"
        >
          Search
          <svg
            className={`transition-transform duration-300 ${canSubmit ? "group-hover:translate-x-0.5" : ""} ${isHero ? "w-3.5 h-3.5" : "w-3 h-3"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </motion.form>
  );
}
