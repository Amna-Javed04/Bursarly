"use client";

/**
 * AuthGuard — protects routes that require authentication + email verification.
 *
 * Usage:
 *   <AuthGuard>
 *     <DashboardPage />
 *   </AuthGuard>
 *
 * Behaviour:
 *   - While session is loading: renders a full-screen spinner.
 *   - If no user: redirects to /login?next=<currentPath>.
 *   - If user exists but email is NOT verified: shows verification notice
 *     with a resend button (does NOT redirect — they stay on the page with a gate).
 *   - If fully authenticated + verified: renders children.
 */

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/app/lib/supabase";
import { useState } from "react";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, router, pathname]);

  // --- Loading spinner ---
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-teal border-t-transparent rounded-full"
        />
      </div>
    );
  }

  // --- Not logged in (redirect in progress) ---
  if (!user) return null;

  // --- Logged in but email not verified ---
  if (!user.email_confirmed_at) {
    async function handleResend() {
      setResending(true);
      await supabase.auth.resend({
        type: "signup",
        email: user!.email!,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setResending(false);
      setResent(true);
    }

    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md text-center bg-white rounded-2xl border border-border/60
            shadow-[var(--shadow-lg)] p-8"
        >
          <div className="w-16 h-16 rounded-full bg-deadline-warning/10 flex items-center
            justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-deadline-warning" fill="none" viewBox="0 0 24 24"
              stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-navy mb-2">Verify your email first</h2>
          <p className="text-text-secondary text-sm mb-1">
            We sent a verification link to
          </p>
          <p className="font-semibold text-navy text-sm mb-5">{user.email}</p>

          {resent ? (
            <p className="text-deadline-safe text-sm font-medium mb-5">
              ✓ Verification email resent — check your inbox!
            </p>
          ) : (
            <button
              onClick={handleResend}
              disabled={resending}
              className="mb-5 text-teal text-sm font-semibold hover:text-teal-dark
                transition-colors disabled:opacity-60"
            >
              {resending ? "Sending…" : "Resend verification email →"}
            </button>
          )}

          <Link
            href="/"
            className="block text-xs text-text-muted hover:text-navy transition-colors"
          >
            ← Back to home
          </Link>
        </motion.div>
      </div>
    );
  }

  // --- Authenticated + verified ---
  return <>{children}</>;
}
