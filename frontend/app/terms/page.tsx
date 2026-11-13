import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms — Bursarly",
  description: "The terms that apply when you use Bursarly.",
};

const SECTIONS = [
  {
    title: "What Bursarly is",
    body: [
      "Bursarly is a free directory and deadline tracker for international scholarships. We are not the scholarship provider, an admissions service, or a visa adviser.",
      "Every listing links to the provider's official page. That page is the only authoritative source for requirements, eligibility and deadlines.",
    ],
  },
  {
    title: "Accuracy",
    body: [
      "We verify deadlines against official pages, and we label the ones we could not confirm. Even so, providers change dates and requirements without notice.",
      "Always confirm on the official page before you apply, pay a fee, or book travel. Bursarly is not liable for missed deadlines or decisions made by scholarship providers.",
    ],
  },
  {
    title: "Your account",
    body: [
      "Keep your login secure and use accurate details. You are responsible for activity on your account.",
      "Do not scrape, resell or bulk-download Bursarly data, and do not attempt to disrupt the service.",
    ],
  },
  {
    title: "Changes",
    body: [
      "We may update these terms as the product changes. Continuing to use Bursarly means you accept the current version.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-jade-deep">Legal</p>
      <h1 className="mt-4 font-display text-[clamp(2rem,4vw,3rem)] leading-tight tracking-[-0.02em] text-navy">
        Terms of use
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-text-secondary">
        Short, because Bursarly does one thing: it helps you find and track scholarships.
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
      </div>

      <div className="mt-14 flex items-center justify-between border-t border-border/60 pt-6">
        <Link href="/" className="link-sweep text-sm font-medium text-navy">
          ← Back to Bursarly
        </Link>
        <Link href="/privacy" className="link-sweep text-sm text-text-secondary">
          Privacy policy
        </Link>
      </div>
    </div>
  );
}
