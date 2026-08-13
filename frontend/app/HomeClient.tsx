"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import SearchBar from "./components/SearchBar";
import PageTransition from "./components/PageTransition";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.12,
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94] as const,
    },
  }),
};

const FEATURES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    title: "Browse & Search",
    description: "Explore verified scholarships from around the world. Filter by country, degree level, and funding type.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Deadline Tracking",
    description: "See at a glance which deadlines are approaching. Color-coded urgency so you never miss one.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: "Application Resources",
    description: "Curated guides, essay tips, and resources for every scholarship to strengthen your application.",
  },
];

export default function HomePage() {
  return (
    <PageTransition>
      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden" id="hero">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(44,166,164,0.06)_0%,_transparent_60%)]" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-16 sm:pb-20">
          <div className="text-center max-w-2xl mx-auto">
            {/* Logo mark */}
            <motion.div
              custom={0}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="mb-6"
            >
              <Image
                src="/logo.png"
                alt="Bursarly"
                width={72}
                height={72}
                className="mx-auto rounded-full"
                priority
              />
            </motion.div>

            {/* Headline */}
            <motion.h1
              custom={1}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-navy leading-tight tracking-tight mb-4"
            >
              Scholarships, deadlines,{" "}
              <span className="text-teal">sorted.</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              custom={2}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="text-base sm:text-lg text-text-secondary leading-relaxed mb-8 max-w-lg mx-auto"
            >
              Track real scholarship deadlines from verified sources. Browse opportunities,
              check requirements, and apply on time — all in one place.
            </motion.p>

            {/* Search Bar */}
            <motion.div
              custom={3}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="flex justify-center mb-6"
            >
              <SearchBar variant="hero" />
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              custom={4}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="flex flex-col sm:flex-row items-center justify-center gap-3"
            >
              <Link
                href="/browse"
                className="inline-flex items-center gap-2 px-6 py-3 bg-navy text-white
                  font-semibold text-sm rounded-xl hover:bg-navy-light
                  shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)]
                  transition-all duration-300 active:scale-[0.98]"
                id="cta-browse"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Browse Scholarships
              </Link>
              <span className="text-xs text-text-muted hidden sm:inline">No sign-up required</span>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section className="py-16 sm:py-20 bg-surface/60" id="features">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-navy mb-3">
              Everything you need to apply on time
            </h2>
            <p className="text-text-secondary max-w-md mx-auto">
              From discovery to application, Bursarly keeps you organized and on track.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="bg-surface rounded-2xl p-6 border border-border/50
                  shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)]
                  transition-all duration-300 group"
              >
                <div className="w-10 h-10 rounded-xl bg-teal/10 text-teal flex items-center justify-center mb-4
                  group-hover:bg-teal/15 transition-colors duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-base font-semibold text-navy mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats / Trust Section ── */}
      <section className="py-14 sm:py-16" id="stats">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-navy rounded-2xl p-8 sm:p-10 text-center"
          >
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
              Verified scholarship data you can trust
            </h3>
            <p className="text-white/60 text-sm mb-8 max-w-md mx-auto">
              Our team verifies every scholarship listing against official sources.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { value: "4+", label: "Scholarships" },
                { value: "4", label: "Countries" },
                { value: "Real", label: "Deadlines" },
                { value: "Free", label: "To Use" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                >
                  <div className="text-2xl sm:text-3xl font-extrabold text-teal-light mb-1">
                    {stat.value}
                  </div>
                  <div className="text-xs text-white/50 font-medium uppercase tracking-wider">
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>
    </PageTransition>
  );
}
