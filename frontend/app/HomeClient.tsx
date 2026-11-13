"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import SearchBar from "./components/SearchBar";
import PageTransition from "./components/PageTransition";
import Reveal from "./components/motion/Reveal";
import SpotlightCard from "./components/motion/SpotlightCard";
import CountUp from "./components/motion/CountUp";
import Marquee from "./components/motion/Marquee";

const EASE = [0.16, 1, 0.3, 1] as const;

const HEADLINE = [
  { text: "Scholarships,", display: false },
  { text: "deadlines,", display: false },
  { text: "sorted.", display: true },
];

const COUNTRIES = [
  { flag: "🇩🇪", name: "Germany" },
  { flag: "🇹🇷", name: "Türkiye" },
  { flag: "🇰🇷", name: "South Korea" },
  { flag: "🇪🇺", name: "European Union" },
];

const FEATURES = [
  {
    step: "01",
    title: "Browse & search",
    description:
      "Explore verified scholarships from around the world. Filter by country, degree level, and funding type in seconds.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    glow: "rgba(194, 101, 139, 0.20)",
  },
  {
    step: "02",
    title: "Track every deadline",
    description:
      "A living countdown for each application, colour-coded by urgency — so nothing slips past you in the final week.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    glow: "rgba(142, 123, 214, 0.20)",
  },
  {
    step: "03",
    title: "Apply with confidence",
    description:
      "Requirement checklists and curated guides for essays, references, and interviews — all in one place.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    glow: "rgba(235, 184, 140, 0.22)",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Tell us what you want",
    body: "Pick your countries, degree level and funding preference. Two minutes, once.",
  },
  {
    n: "02",
    title: "Save what fits",
    body: "Add scholarships to your tracker and watch the countdowns do the remembering.",
  },
  {
    n: "03",
    title: "Submit on time",
    body: "Work through the checklist — documents, essays, references — before the clock runs out.",
  },
];

interface Stat {
  label: string;
  value?: number;
  suffix?: string;
  text?: string;
}

export default function HomePage() {
  const reduce = useReducedMotion();

  // Cursor parallax for the floating hero cluster
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 18, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 60, damping: 18, mass: 0.6 });
  const cardX = useTransform(sx, [-0.5, 0.5], [-16, 16]);
  const cardY = useTransform(sy, [-0.5, 0.5], [-12, 12]);
  const backX = useTransform(sx, [-0.5, 0.5], [10, -10]);
  const backY = useTransform(sy, [-0.5, 0.5], [8, -8]);

  const heroRef = useRef<HTMLDivElement>(null);

  // Real catalogue numbers — never hardcoded marketing figures.
  const [stats, setStats] = useState<Stat[]>([
    { label: "Scholarships tracked" },
    { label: "Countries covered" },
    { label: "Linked source pages", text: "Official" },
    { label: "Cost, forever", text: "Free" },
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getScholarships } = await import("./lib/api");
        const list = await getScholarships();
        if (cancelled) return;
        const countries = new Set(list.map((s) => s.country));
        setStats([
          { label: "Scholarships tracked", value: list.length, suffix: "" },
          { label: "Countries covered", value: countries.size, suffix: "" },
          { label: "Linked source pages", text: "Official" },
          { label: "Cost, forever", text: "Free" },
        ]);
      } catch {
        // Backend offline: keep the neutral labels rather than invent numbers.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleHeroMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduce) return;
    const rect = heroRef.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  return (
    <PageTransition>
      {/* ── Hero ── */}
      <section
        ref={heroRef}
        onMouseMove={handleHeroMove}
        className="relative -mt-[78px] overflow-hidden"
        id="hero"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[52rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(242,175,201,0.4),transparent_66%)] blur-3xl"
        />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-[142px] sm:pt-[164px] pb-16 lg:pb-24">
          <div className="grid lg:grid-cols-[1.02fr_0.98fr] gap-14 lg:gap-8 items-center">
            {/* Copy */}
            <div className="max-w-xl">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: EASE }}
                className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3.5 py-1.5 shadow-[var(--shadow-sm)] backdrop-blur-md mb-7"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-jade opacity-75 animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-jade" />
                </span>
                <span className="text-[11.5px] font-medium tracking-[0.06em] uppercase text-text-secondary">
                  Deadlines verified · Always free
                </span>
              </motion.div>

              <h1 className="font-display text-[clamp(2.9rem,7vw,4.9rem)] leading-[0.95] tracking-[-0.02em] text-navy">
                {HEADLINE.map((line, i) => (
                  <span key={line.text} className="block overflow-hidden">
                    <motion.span
                      initial={{ y: "110%", opacity: 0 }}
                      animate={{ y: "0%", opacity: 1 }}
                      transition={{ duration: 1.05, delay: 0.1 + i * 0.11, ease: EASE }}
                      className={`block ${line.display ? "italic text-gradient pb-2" : ""}`}
                    >
                      {line.text}
                    </motion.span>
                  </span>
                ))}
              </h1>

              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.45, ease: EASE }}
                className="mt-6 text-[15.5px] sm:text-base leading-relaxed text-text-secondary max-w-md"
              >
                Track real scholarship deadlines from verified sources. Browse opportunities,
                check requirements, and apply on time — all in one calm place.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.58, ease: EASE }}
                className="mt-8 flex justify-start"
              >
                <SearchBar variant="hero" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.7, ease: EASE }}
                className="mt-5 flex flex-col sm:flex-row items-start sm:items-center gap-3"
              >
                <Link
                  href="/browse"
                  id="cta-browse"
                  className="btn-shine group inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-3
                    text-[13.5px] font-semibold text-white
                    shadow-[0_18px_40px_-20px_rgba(59,37,64,0.85)]
                    transition-all duration-500 hover:-translate-y-0.5 hover:bg-navy-light"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Browse scholarships
                    <svg className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </span>
                </Link>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("open-bursarly-chat"))}
                  id="cta-ask-ai"
                  className="group inline-flex items-center gap-2 rounded-xl border border-navy/10 bg-white/60
                    px-5 py-3 text-[13.5px] font-medium text-navy/75 backdrop-blur-md
                    transition-all duration-500 hover:border-teal/40 hover:text-navy hover:bg-white/90"
                >
                  <span className="text-jade transition-transform duration-500 group-hover:rotate-12">✦</span>
                  Ask Bursarly AI
                </button>
              </motion.div>
            </div>

            {/* Floating cluster */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.2, delay: 0.35, ease: EASE }}
              className="relative hidden lg:block h-[440px]"
              aria-hidden="true"
            >
              <div className="absolute inset-10 rounded-full bg-jade/20 blur-[90px]" />

              {/* back card */}
              <motion.div
                style={reduce ? undefined : { x: backX, y: backY }}
                className="absolute right-4 top-2 w-[240px] rounded-2xl border border-white/70 bg-white/85 p-4 shadow-[var(--shadow-lg)] backdrop-blur-xl float-soft"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Readiness</span>
                  <span className="text-[11px] text-jade font-semibold">82%</span>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "82%" }}
                    transition={{ duration: 1.6, delay: 0.9, ease: EASE }}
                    className="h-full rounded-full bg-gradient-to-r from-jade to-[#8FE9D2]"
                  />
                </div>
                <div className="mt-3 space-y-2">
                  {["Transcript", "Motivation letter", "Reference #1"].map((item, i) => (
                    <div key={item} className="flex items-center gap-2 text-[11px] text-text-secondary">
                      <span className={`grid place-items-center w-3.5 h-3.5 rounded-full text-[8px] ${i < 2 ? "bg-teal/15 text-teal-dark" : "bg-navy/[0.06] text-text-muted"}`}>
                        {i < 2 ? "✓" : ""}
                      </span>
                      {item}
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* main card */}
              <motion.div
                style={reduce ? undefined : { x: cardX, y: cardY }}
                className="absolute left-0 top-16 w-[330px] rounded-[22px] border border-white/70 bg-white/90 p-5
                  shadow-[0_32px_70px_-34px_rgba(59,37,64,0.4)] backdrop-blur-2xl"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Tracked</p>
                    <h3 className="mt-1 text-[15px] font-semibold text-navy leading-snug">
                      DAAD EPOS
                      <br />
                      Development-Related Postgraduate
                    </h3>
                  </div>
                  <span className="grid place-items-center w-9 h-9 rounded-full bg-surface-raised text-base ring-1 ring-black/[0.05]">
                    🇩🇪
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {["Fully funded", "Masters", "Germany"].map((tag) => (
                    <span key={tag} className="rounded-full border border-navy/[0.08] bg-surface-raised px-2.5 py-1 text-[10.5px] text-text-secondary">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] font-semibold text-deadline-urgent">9 days left</span>
                    <span className="text-[10.5px] text-text-muted tabular-nums">15 Dec 2026</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "88%" }}
                      transition={{ duration: 1.6, delay: 0.8, ease: EASE }}
                      className="h-full rounded-full bg-gradient-to-r from-[#C2658B] to-[#8E7BD6]"
                    />
                  </div>
                </div>
              </motion.div>

              {/* floating chip */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1, duration: 0.8, ease: EASE }}
                className="absolute bottom-6 right-2 flex items-center gap-2 rounded-full border border-white/70 bg-white/85 px-3.5 py-2 shadow-[var(--shadow-md)] backdrop-blur-xl"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-jade pulse-dot" />
                <span className="text-[11px] text-text-secondary">Deadline synced · just now</span>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Country ticker */}
        <div className="relative border-y border-navy/[0.07] py-3.5">
          <Marquee duration={38}>
            {[...COUNTRIES, ...COUNTRIES, ...COUNTRIES, ...COUNTRIES].map((c, i) => (
              <span key={`${c.name}-${i}`} className="flex items-center gap-2.5 px-7 text-[11.5px] uppercase tracking-[0.18em] text-text-muted">
                <span className="text-sm not-italic opacity-80">{c.flag}</span>
                {c.name}
                <span className="ml-4 h-1 w-1 rounded-full bg-navy/20" />
              </span>
            ))}
          </Marquee>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="relative py-20 sm:py-28" id="features">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <Reveal>
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-jade-deep">
                Why Bursarly
              </span>
            </Reveal>
            <Reveal delay={0.06}>
              <h2 className="mt-4 text-[clamp(1.9rem,3.6vw,2.9rem)] font-semibold tracking-[-0.03em] text-navy leading-[1.08]">
                Everything you need to apply on time —{" "}
                <span className="font-display italic text-teal-dark">nothing you don&apos;t.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="mt-4 text-[15px] text-text-secondary leading-relaxed max-w-lg">
                From discovery to submission, Bursarly keeps the whole application organised and quiet.
              </p>
            </Reveal>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {FEATURES.map((feature, i) => (
              <Reveal key={feature.title} delay={0.08 * i} y={28}>
                <SpotlightCard
                  tilt
                  glow={feature.glow}
                  className="h-full rounded-[24px] border border-black/[0.06] bg-white p-6 sm:p-7
                    shadow-[0_1px_2px_rgba(5,8,15,0.04)] transition-shadow duration-500
                    hover:shadow-[0_30px_60px_-34px_rgba(5,8,15,0.35)]"
                >
                  <div className="flex items-start justify-between mb-8">
                    <span className="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-[#C2658B] to-[#8E7BD6] text-white shadow-[0_10px_24px_-14px_rgba(194,101,139,0.85)]">
                      {feature.icon}
                    </span>
                    <span className="font-display text-2xl text-navy/15">{feature.step}</span>
                  </div>
                  <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-navy">
                    {feature.title}
                  </h3>
                  <p className="mt-2.5 text-[13.5px] leading-relaxed text-text-secondary">
                    {feature.description}
                  </p>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="relative pb-20 sm:pb-28" id="how-it-works">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-[32px] border border-black/[0.05] bg-white/60 backdrop-blur-sm px-6 sm:px-10 py-10 sm:py-12">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
              <Reveal>
                <h2 className="text-[clamp(1.6rem,3vw,2.2rem)] font-semibold tracking-[-0.03em] text-navy leading-tight">
                  Three steps.{" "}
                  <span className="font-display italic text-teal-dark">Zero missed dates.</span>
                </h2>
              </Reveal>
              <Reveal delay={0.08}>
                <Link
                  href="/browse"
                  className="group inline-flex items-center gap-2 text-sm font-medium text-navy"
                >
                  <span className="link-sweep">Start browsing</span>
                  <span className="grid place-items-center w-6 h-6 rounded-full bg-navy/[0.06] transition-all duration-500 group-hover:bg-jade group-hover:text-[var(--ink)]">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </span>
                </Link>
              </Reveal>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-black/[0.06] rounded-2xl overflow-hidden">
              {STEPS.map((step, i) => (
                <Reveal key={step.n} delay={0.1 * i} className="bg-white/40">
                  <div className="group h-full p-6 sm:p-7 transition-colors duration-500 hover:bg-white">
                    <div className="flex items-center gap-3">
                      <span className="font-display text-[28px] leading-none text-jade-deep">{step.n}</span>
                      <span className="h-px flex-1 bg-black/[0.08] transition-colors duration-500 group-hover:bg-jade/30" />
                    </div>
                    <h3 className="mt-5 text-[15px] font-semibold text-navy">{step.title}</h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">{step.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="relative py-16 sm:py-20" id="stats">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-[32px] border border-navy/[0.07] bg-white/55 px-6 py-10 backdrop-blur-sm sm:px-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-6">
            {stats.map((stat, i) => (
              <Reveal key={stat.label} delay={i * 0.07}>
                <div className="text-center md:text-left">
                  <div className="font-display text-[clamp(2.2rem,4vw,3.1rem)] leading-none text-navy">
                    {typeof stat.value === "number" ? (
                      <span className="inline-flex items-baseline">
                        <CountUp to={stat.value} suffix={stat.suffix ?? ""} duration={1.1} />
                      </span>
                    ) : (
                      <span className="text-gradient">{stat.text ?? "—"}</span>
                    )}
                  </div>
                  <div className="mt-3 text-[10.5px] font-medium uppercase tracking-[0.18em] text-text-muted">
                    {stat.label}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.2}>
            <div className="mt-12 pt-8 border-t border-navy/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <p className="text-[13px] text-text-secondary max-w-md leading-relaxed">
                Every listing is checked against an official source before it goes live. If a deadline
                moves, the tracker moves with it.
              </p>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-teal pulse-dot" />
                Data verified continuously
              </div>
            </div>
          </Reveal>
          </div>
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section className="relative py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal scale>
            <div className="relative overflow-hidden rounded-[36px] border border-white/70 bg-white/85 px-6 sm:px-12 py-14 sm:py-20 text-center shadow-[var(--shadow-lg)] backdrop-blur-md">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-teal/25 via-cobalt/20 to-gold/25 blur-[70px]"
              />
              <div className="relative">
                <div className="mx-auto mb-6 grid place-items-center">
                  <motion.div
                    animate={reduce ? undefined : { y: [0, -6, 0] }}
                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Image
                      src="/logo.png"
                      alt="Bursarly"
                      width={56}
                      height={56}
                      className="rounded-full ring-1 ring-black/5"
                    />
                  </motion.div>
                </div>
                <h2 className="font-display text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.02] tracking-[-0.02em] text-navy">
                  Your next chapter starts with{" "}
                  <span className="italic text-teal-dark">one deadline.</span>
                </h2>
                <p className="mt-4 text-[14.5px] text-text-secondary max-w-md mx-auto leading-relaxed">
                  Free to use, no noise. Save what fits, and let Bursarly remember the dates for you.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link
                    href="/signup"
                    className="btn-shine group inline-flex items-center gap-2 rounded-xl bg-navy px-6 py-3.5
                      text-[13.5px] font-semibold text-white shadow-[0_18px_40px_-20px_rgba(31,56,100,0.9)]
                      transition-all duration-500 hover:-translate-y-0.5 hover:bg-navy-light"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      Create free account
                      <svg className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </span>
                  </Link>
                  <Link
                    href="/browse"
                    className="group inline-flex items-center gap-2 rounded-xl border border-black/10 px-6 py-3.5
                      text-[13.5px] font-medium text-navy transition-all duration-500 hover:border-black/20 hover:bg-navy/[0.03]"
                  >
                    Explore scholarships
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </PageTransition>
  );
}
