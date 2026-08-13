import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-border/50 bg-surface mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="Bursarly" width={28} height={28} className="rounded-full" />
              <span className="text-base font-bold text-navy">Bursarly</span>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed max-w-xs">
              Scholarships, deadlines, sorted. Never miss a deadline with organized tracking and curated resources.
            </p>
          </div>

          {/* Links */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-navy">Quick Links</h4>
            <div className="space-y-2">
              <Link href="/browse" className="block text-sm text-text-secondary hover:text-teal transition-colors">
                Browse Scholarships
              </Link>
              <Link href="/search" className="block text-sm text-text-secondary hover:text-teal transition-colors">
                Search
              </Link>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-navy">About</h4>
            <p className="text-sm text-text-secondary leading-relaxed">
              Bursarly tracks real scholarship deadlines from verified sources. We help students worldwide find and apply on time.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border/50 text-center">
          <p className="text-xs text-text-muted">
            © {new Date().getFullYear()} Bursarly. Built with care for students everywhere.
          </p>
        </div>
      </div>
    </footer>
  );
}
