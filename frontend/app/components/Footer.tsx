import Image from "next/image";
import Link from "next/link";
import AuroraField from "./motion/AuroraField";

const LINKS = [
  { href: "/browse", label: "Browse scholarships" },
  { href: "/search", label: "Search" },
  { href: "/dashboard", label: "Your tracker" },
];

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-[var(--ink)] text-white mt-auto grain">
      <AuroraField intensity={0.28} grid={false} />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8">
          {/* Brand */}
          <div className="md:col-span-5 space-y-5">
            <div className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="Bursarly" width={30} height={30} className="rounded-full ring-1 ring-white/15" />
              <span className="text-base font-semibold tracking-[-0.02em]">Bursarly</span>
            </div>
            <p className="font-display text-3xl sm:text-4xl leading-[1.1] text-white/85 max-w-sm">
              Scholarships, deadlines,{" "}
              <span className="italic text-gradient-light">sorted.</span>
            </p>
            <p className="text-sm text-white/45 leading-relaxed max-w-xs">
              Real deadlines from verified sources — so the only thing left to do is apply.
            </p>
          </div>

          {/* Links */}
          <div className="md:col-span-3 md:col-start-7 space-y-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">Explore</h4>
            <ul className="space-y-3">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="group inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors duration-300"
                  >
                    <span className="h-px w-0 bg-jade transition-all duration-500 group-hover:w-4" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Info */}
          <div className="md:col-span-3 space-y-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">About</h4>
            <p className="text-sm text-white/45 leading-relaxed">
              We help students worldwide find and apply on time. Every listing is checked against an
              official source before it goes live.
            </p>
          </div>
        </div>

        <div className="mt-14 pt-6 border-t border-white/[0.07] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/30">
            © {new Date().getFullYear()} Bursarly. Built with care for students everywhere.
          </p>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="text-xs text-white/40 transition-colors hover:text-white/80">
              Privacy
            </Link>
            <Link href="/terms" className="text-xs text-white/40 transition-colors hover:text-white/80">
              Terms
            </Link>
            <p className="text-xs text-white/25">Deadlines verified · Updated continuously</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
