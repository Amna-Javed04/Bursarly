import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy — Bursarly",
  description: "What Bursarly stores, what it does not, and how scholarship data is verified.",
};

const SECTIONS = [
  {
    title: "What we store",
    body: [
      "If you create an account we store your email address, the preferences you choose during onboarding (degree level, countries of interest, field of study, funding need), and the scholarships you add to your tracker.",
      "Authentication is handled by Supabase. We never see or store your password.",
      "Tracker entries record which documents and eligibility criteria you have ticked off. They are private to your account.",
    ],
  },
  {
    title: "What we do not store",
    body: [
      "We do not store payment details — Bursarly is free to use.",
      "We do not sell personal data, and we do not run advertising trackers.",
      "Chat messages are processed to answer your question. An unmatched question may be stored without your identity so we can add the missing scholarship.",
    ],
  },
  {
    title: "Scholarship data and verification",
    body: [
      "Deadlines and requirements are collected from the scholarship provider's official page. Every date is graded: a date shown as an official date was found on that page.",
      "Dates that differ by country, embassy, university or consortium track are not presented as a single countdown. They are labelled as varying, with a link to the official source.",
      "If we cannot read an official page automatically, the listing says so rather than presenting unverified details as fact.",
    ],
  },
  {
    title: "Your controls",
    body: [
      "You can remove a tracked scholarship at any time from your dashboard, and you can update your preferences whenever you like.",
      "To delete your account and all associated data, contact us at the address below and we will remove it.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-jade-deep">Legal</p>
      <h1 className="mt-4 font-display text-[clamp(2rem,4vw,3rem)] leading-tight tracking-[-0.02em] text-navy">
        Privacy, in plain language
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-text-secondary">
        Bursarly exists to help you apply on time. That needs very little of your data, and we keep it
        that way.
      </p>

      <div className="mt-12 space-y-10">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-navy">{section.title}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="mt-3 text-[14px] leading-relaxed text-text-secondary">
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        <section>
          <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-navy">Contact</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-text-secondary">
            Questions about your data? Write to{" "}
            <a href="mailto:privacy@bursarly.com" className="link-sweep text-teal-dark">
              privacy@bursarly.com
            </a>
            .
          </p>
        </section>
      </div>

      <div className="mt-14 flex items-center justify-between border-t border-border/60 pt-6">
        <Link href="/" className="link-sweep text-sm font-medium text-navy">
          ← Back to Bursarly
        </Link>
        <Link href="/terms" className="link-sweep text-sm text-text-secondary">
          Terms of use
        </Link>
      </div>
    </div>
  );
}
