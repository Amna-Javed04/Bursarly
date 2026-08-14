"use client";

import { useState, useId, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/app/lib/supabase";
import PageTransition from "@/app/components/PageTransition";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = useId();

  // Redirect to the page the user originally wanted, or default to home
  const redirectTo = searchParams.get("next") || "/";

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState(false);

  // Did they arrive from email verification success?
  const verified = searchParams.get("verified") === "1";

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setServerError("");
    setUnverifiedEmail(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setServerError("");
    setUnverifiedEmail(false);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: form.email.trim().toLowerCase(),
      password: form.password,
    });

    setLoading(false);

    if (error) {
      // Check for unverified-email error code from Supabase
      if (
        error.message?.toLowerCase().includes("email not confirmed") ||
        error.message?.toLowerCase().includes("email_not_confirmed")
      ) {
        setUnverifiedEmail(true);
        return;
      }
      console.error("Supabase Auth Error:", error);
      setServerError(`Error: ${error.message}`);
      return;
    }

    // Enforce email verification on the client side as well
    if (!data.user?.email_confirmed_at) {
      setUnverifiedEmail(true);
      await supabase.auth.signOut(); // clear any partial session
      return;
    }

    router.replace(redirectTo);
    router.refresh(); // force layout re-render so Navbar reflects signed-in state
  }

  async function resendVerification() {
    if (!form.email) {
      setServerError("Please enter your email address above first.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: form.email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (!error) {
      setServerError("");
      setUnverifiedEmail(false);
      setServerError("✓ Verification email resent. Please check your inbox.");
    }
  }

  return (
    <PageTransition>
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="bg-white rounded-2xl shadow-[var(--shadow-lg)] border border-border/60 p-8"
          >
            {/* Header */}
            <div className="mb-8 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-navy to-teal mb-4">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l6.16-3.422A12.083 12.083 0 0121 21H3a12.083 12.083 0 012.84-10.422L12 14z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-navy">Welcome back</h1>
              <p className="text-text-secondary text-sm mt-1.5">
                Sign in to continue tracking your scholarships
              </p>
            </div>

            {/* Email verified success banner */}
            <AnimatePresence>
              {verified && (
                <motion.div
                  key="verified-banner"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-5 px-4 py-3 bg-deadline-safe/10 border border-deadline-safe/30 rounded-xl text-deadline-safe text-sm font-medium flex items-center gap-2"
                  role="status"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Email verified successfully! You can now sign in.
                </motion.div>
              )}
            </AnimatePresence>

            {/* Unverified email warning */}
            <AnimatePresence>
              {unverifiedEmail && (
                <motion.div
                  key="unverified"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-5 px-4 py-3 bg-deadline-warning/10 border border-deadline-warning/30 rounded-xl text-sm"
                  role="alert"
                  aria-live="polite"
                >
                  <p className="font-semibold text-deadline-warning mb-1">Email not verified</p>
                  <p className="text-text-secondary text-xs mb-2">
                    Please verify your email before signing in.
                  </p>
                  <button
                    onClick={resendVerification}
                    disabled={loading}
                    className="text-teal text-xs font-semibold hover:text-teal-dark transition-colors disabled:opacity-60"
                  >
                    Resend verification email →
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Server error */}
            <AnimatePresence>
              {serverError && !unverifiedEmail && (
                <motion.div
                  key="server-error"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`mb-5 px-4 py-3 rounded-xl text-sm font-medium border ${
                    serverError.startsWith("✓")
                      ? "bg-deadline-safe/10 border-deadline-safe/30 text-deadline-safe"
                      : "bg-deadline-urgent/10 border-deadline-urgent/30 text-deadline-urgent"
                  }`}
                  role="alert"
                  aria-live="assertive"
                >
                  {serverError}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {/* Email */}
              <div>
                <label htmlFor={`${uid}-email`} className="block text-sm font-medium text-navy mb-1.5">
                  Email address
                </label>
                <input
                  id={`${uid}-email`}
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@university.edu"
                  className="w-full px-4 py-3 rounded-xl border border-border hover:border-navy/30 bg-surface-raised text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal/40 focus:border-teal"
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor={`${uid}-password`} className="block text-sm font-medium text-navy">
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-teal hover:text-teal-dark transition-colors font-medium"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id={`${uid}-password`}
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Your password"
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-border hover:border-navy/30 bg-surface-raised text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal/40 focus:border-teal"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-navy transition-colors p-1"
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <motion.button
                type="submit"
                id="login-submit-btn"
                disabled={loading}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3.5 rounded-xl font-semibold text-white text-sm bg-gradient-to-r from-navy to-teal hover:from-navy-light hover:to-teal-light disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in…
                  </span>
                ) : (
                  "Sign in"
                )}
              </motion.button>
            </form>

            <p className="mt-6 text-center text-sm text-text-secondary">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-semibold text-teal hover:text-teal-dark transition-colors">
                Sign up free
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[80vh] flex items-center justify-center text-navy font-medium">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
