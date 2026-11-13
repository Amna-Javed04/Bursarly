"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/app/context/AuthContext";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Browse" },
];

const AUTH_NAV_LINKS = [{ href: "/dashboard", label: "Dashboard" }];

const spring = { type: "spring", stiffness: 380, damping: 32 } as const;

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    router.replace("/");
    router.refresh();
  }

  const isDashboard = pathname === "/dashboard";

  return (
    <header className="sticky top-0 z-50 px-3 sm:px-4 pt-3 pb-1">
      <motion.div
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className={`mx-auto max-w-6xl rounded-[20px] border transition-all duration-500
          ${scrolled
            ? "border-white/70 bg-white/85 shadow-[0_14px_40px_-22px_rgba(59,37,64,0.35)] backdrop-blur-2xl"
            : "border-white/50 bg-white/55 shadow-[0_2px_20px_-14px_rgba(59,37,64,0.22)] backdrop-blur-xl"
          }`}
      >
        <div className="flex items-center justify-between h-[62px] px-3.5 sm:px-5">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group" id="nav-logo">
            <span className="relative inline-flex">
              <span className="absolute inset-0 rounded-full bg-jade/40 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <Image
                src="/logo.png"
                alt="Bursarly Logo"
                width={34}
                height={34}
                className="relative rounded-full ring-1 ring-black/5 transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-6"
              />
            </span>
            <span className="text-[17px] font-semibold tracking-[-0.02em] text-navy">
              Bursarly
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1" id="nav-desktop">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-3.5 py-1.5 text-[13.5px] font-medium rounded-full transition-colors duration-300
                    ${isActive ? "text-navy" : "text-text-secondary hover:text-navy"}`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-full bg-navy/[0.06]"
                      transition={spring}
                    />
                  )}
                  <span className="relative z-10">{link.label}</span>
                </Link>
              );
            })}

            {/* Auth controls */}
            {!loading && (
              <div className="flex items-center gap-1.5 ml-2 pl-2.5 border-l border-border/60">
                {user ? (
                  <>
                    <Link
                      href="/dashboard"
                      id="nav-dashboard-btn"
                      className={`relative px-3.5 py-1.5 text-[13.5px] font-medium rounded-full transition-colors duration-300
                        ${isDashboard ? "text-navy" : "text-text-secondary hover:text-navy"}`}
                    >
                      {isDashboard && (
                        <motion.span
                          layoutId="nav-pill"
                          className="absolute inset-0 rounded-full bg-navy/[0.06]"
                          transition={spring}
                        />
                      )}
                      <span className="relative z-10">Dashboard</span>
                    </Link>
                    <span
                      className="hidden lg:block text-xs text-text-muted truncate max-w-[130px]"
                      title={user.email ?? ""}
                    >
                      {user.email}
                    </span>
                    <button
                      id="nav-signout-btn"
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className="px-3 py-1.5 text-[13px] font-medium rounded-full border border-border/80
                        text-text-secondary hover:text-deadline-urgent hover:border-deadline-urgent/40
                        hover:bg-deadline-urgent/[0.04] transition-all duration-300 disabled:opacity-50"
                    >
                      {signingOut ? "Signing out…" : "Sign out"}
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      id="nav-login-btn"
                      className="px-3.5 py-1.5 text-[13.5px] font-medium rounded-full text-navy
                        hover:bg-navy/[0.05] transition-colors duration-300"
                    >
                      Log in
                    </Link>
                    <Link
                      href="/signup"
                      id="nav-signup-btn"
                      className="btn-shine group relative px-4 py-2 text-[13.5px] font-semibold rounded-full text-[var(--ink)]
                        bg-gradient-to-r from-[#F2AFC9] via-[#D98CAC] to-[#B9A6E8]
                        shadow-[0_8px_24px_-12px_rgba(194,101,139,0.55)]
                        hover:shadow-[0_12px_30px_-10px_rgba(194,101,139,0.6)]
                        hover:-translate-y-px transition-all duration-300"
                    >
                      <span className="relative z-10 flex items-center gap-1.5">
                        Sign up
                        <svg className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                      </span>
                    </Link>
                  </>
                )}
              </div>
            )}
          </nav>

          {/* Mobile Toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden relative p-2 rounded-full text-navy hover:bg-navy/[0.06] transition-colors"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            id="nav-mobile-toggle"
          >
            <span className="relative block w-5 h-4">
              <motion.span
                animate={mobileOpen ? { top: 7, rotate: 45 } : { top: 1, rotate: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute left-0 w-5 h-[1.8px] rounded bg-current"
              />
              <motion.span
                animate={mobileOpen ? { opacity: 0, x: 6 } : { opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute left-0 top-[7px] w-5 h-[1.8px] rounded bg-current"
              />
              <motion.span
                animate={mobileOpen ? { top: 7, rotate: -45 } : { top: 13, rotate: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute left-0 w-5 h-[1.8px] rounded bg-current"
              />
            </span>
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence initial={false}>
          {mobileOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="md:hidden overflow-hidden"
              id="nav-mobile-menu"
            >
              <div className="px-3 pb-3 pt-1 space-y-1 border-t border-border/50">
                {NAV_LINKS.map((link, i) => {
                  const isActive = pathname === link.href;
                  return (
                    <motion.div
                      key={link.href}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04 * i }}
                    >
                      <Link
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors
                          ${isActive
                            ? "text-navy bg-jade/10"
                            : "text-text-secondary hover:text-navy hover:bg-navy/[0.04]"
                          }`}
                      >
                        {link.label}
                      </Link>
                    </motion.div>
                  );
                })}

                {!loading && (
                  <div className="pt-2 mt-2 border-t border-border/50 space-y-1">
                    {user ? (
                      <>
                        <p className="px-4 py-1 text-xs text-text-muted truncate">{user.email}</p>
                        <button
                          id="nav-mobile-signout-btn"
                          onClick={() => { setMobileOpen(false); handleSignOut(); }}
                          disabled={signingOut}
                          className="block w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium
                            text-deadline-urgent hover:bg-deadline-urgent/5 transition-colors"
                        >
                          Sign out
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          href="/login"
                          onClick={() => setMobileOpen(false)}
                          className="block px-4 py-2.5 rounded-xl text-sm font-medium
                            text-text-secondary hover:text-navy hover:bg-navy/[0.04] transition-colors"
                        >
                          Log in
                        </Link>
                        <Link
                          href="/signup"
                          onClick={() => setMobileOpen(false)}
                          className="block px-4 py-2.5 rounded-xl text-sm font-semibold text-[var(--ink)]
                            bg-gradient-to-r from-[#F2AFC9] to-[#B9A6E8] text-center"
                        >
                          Sign up free
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </motion.div>
    </header>
  );
}
