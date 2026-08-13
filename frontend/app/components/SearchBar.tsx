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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  };

  const isHero = variant === "hero";

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4 }}
      className={`relative w-full ${isHero ? "max-w-xl" : "max-w-md"}`}
      id="search-form"
    >
      <div
        className={`relative flex items-center bg-surface border rounded-xl
          shadow-[var(--shadow-sm)] focus-within:shadow-[var(--shadow-md)]
          focus-within:border-teal/40 transition-all duration-300
          ${isHero
            ? "border-border h-14 text-base"
            : "border-border/70 h-11 text-sm"
          }`}
      >
        {/* Search icon */}
        <div className={`flex-shrink-0 text-text-muted ${isHero ? "pl-4" : "pl-3"}`}>
          <svg
            className={`${isHero ? "w-5 h-5" : "w-4 h-4"}`}
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
          placeholder={placeholder}
          className={`flex-1 bg-transparent border-none outline-none text-text-primary
            placeholder:text-text-muted/70 font-medium
            ${isHero ? "px-3 text-base" : "px-2.5 text-sm"}`}
          id="search-input"
        />

        <button
          type="submit"
          disabled={!query.trim()}
          className={`flex-shrink-0 bg-navy text-white font-medium rounded-lg
            hover:bg-navy-light disabled:opacity-40 disabled:cursor-not-allowed
            transition-all duration-200 active:scale-[0.97]
            ${isHero ? "mr-1.5 px-5 py-2 text-sm" : "mr-1 px-3.5 py-1.5 text-xs"}`}
          id="search-submit"
        >
          Search
        </button>
      </div>
    </motion.form>
  );
}
