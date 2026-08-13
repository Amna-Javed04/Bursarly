"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/app/context/AuthContext";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Browse" },
];

const AUTH_NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { user, loading, signOut } = useAuth();

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    router.replace("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-md border-b border-border/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group" id="nav-logo">
            <Image
              src="/logo.png"
              alt="Bursarly Logo"
              width={36}
              height={36}
              className="rounded-full transition-transform duration-200 group-hover:scale-105"
            />
            <span className="text-lg font-bold text-navy tracking-tight">
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
                  className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200
                    ${isActive
                      ? "text-navy"
                      : "text-text-secondary hover:text-navy hover:bg-surface-overlay"
                    }`}
                >
                  {link.label}
                  {isActive && (
                    <motion.div
                      layoutId="navbar-indicator"
                      className="absolute bottom-0 left-2 right-2 h-0.5 bg-teal rounded-full"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}

            {/* Auth controls */}
            {!loading && (
              <div className="flex items-center gap-2 ml-3 pl-3 border-l border-border/60">
                {user ? (
                  /* Signed in: Dashboard link + user email chip + preferences + sign out */
                  <>
                    <Link
                      href="/dashboard"
                      id="nav-dashboard-btn"
                      className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200
                        ${pathname === '/dashboard'
                          ? 'text-navy'
                          : 'text-text-secondary hover:text-navy hover:bg-surface-overlay'
                        }`}
                    >
                      Dashboard
                      {pathname === '/dashboard' && (
                        <motion.div
                          layoutId="navbar-indicator"
                          className="absolute bottom-0 left-2 right-2 h-0.5 bg-teal rounded-full"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                    </Link>
                    <span
                      className="hidden lg:block text-xs text-text-secondary truncate max-w-[140px]"
                      title={user.email ?? ""}
                    >
                      {user.email}
                    </span>
                    <button
                      id="nav-signout-btn"
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className="px-4 py-1.5 text-sm font-medium rounded-lg border border-border
                        text-text-secondary hover:text-deadline-urgent hover:border-deadline-urgent/40
                        transition-colors duration-200 disabled:opacity-50"
                    >
                      {signingOut ? "Signing out…" : "Sign out"}
                    </button>
                  </>
                ) : (
                  /* Signed out: login + signup */
                  <>
                    <Link
                      href="/login"
                      id="nav-login-btn"
                      className="px-4 py-1.5 text-sm font-medium rounded-lg text-navy
                        hover:bg-surface-overlay transition-colors duration-200"
                    >
                      Log in
                    </Link>
                    <Link
                      href="/signup"
                      id="nav-signup-btn"
                      className="px-4 py-2 text-sm font-semibold rounded-lg text-white
                        bg-gradient-to-r from-navy to-teal hover:from-navy-light hover:to-teal-light
                        transition-all duration-200 shadow-sm"
                    >
                      Sign up
                    </Link>
                  </>
                )}
              </div>
            )}
          </nav>

          {/* Mobile Toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg text-text-secondary hover:bg-surface-overlay transition-colors"
            aria-label="Toggle menu"
            id="nav-mobile-toggle"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-t border-border/50 bg-surface"
            id="nav-mobile-menu"
          >
            <div className="px-4 py-3 space-y-1">
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
                      ${isActive
                        ? "text-navy bg-teal/10"
                        : "text-text-secondary hover:text-navy hover:bg-surface-overlay"
                      }`}
                  >
                    {link.label}
                  </Link>
                );
              })}

              {/* Mobile auth controls */}
              {!loading && (
                <div className="pt-2 mt-2 border-t border-border/50 space-y-1">
                  {user ? (
                    <>
                      <p className="px-4 py-1 text-xs text-text-muted truncate">{user.email}</p>
                      <button
                        id="nav-mobile-signout-btn"
                        onClick={() => { setMobileOpen(false); handleSignOut(); }}
                        disabled={signingOut}
                        className="block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium
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
                        className="block px-4 py-2.5 rounded-lg text-sm font-medium
                          text-text-secondary hover:text-navy hover:bg-surface-overlay transition-colors"
                      >
                        Log in
                      </Link>
                      <Link
                        href="/signup"
                        onClick={() => setMobileOpen(false)}
                        className="block px-4 py-2.5 rounded-lg text-sm font-semibold text-white
                          bg-gradient-to-r from-navy to-teal text-center transition-colors"
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
    </header>
  );
}
