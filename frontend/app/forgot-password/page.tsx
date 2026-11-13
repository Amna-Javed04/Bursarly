"use client";

import { useState, useId } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/app/lib/supabase";

export default function ForgotPasswordPage() {
  const uid = useId();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    setError("");

    // Always show success — prevents email enumeration.
    // Supabase will only send if the email exists.
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md text-center"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-teal/10 mb-6">
            <svg className="w-10 h-10 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5
                  a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-navy mb-3">Check your email</h1>
          <p className="text-text-secondary mb-2 text-sm">
            If <strong className="text-navy">{email}</strong> is registered, you&apos;ll receive a
            password reset link shortly.
          </p>
          <p className="text-text-muted text-xs mb-8">
            Didn&apos;t receive it? Check your spam folder.
          </p>
          <Link href="/login"
            className="inline-block px-6 py-3 bg-navy text-white rounded-xl font-semibold text-sm
              hover:bg-navy-light transition-colors">
            Back to login
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="bg-white rounded-2xl shadow-[var(--shadow-lg)] border border-border/60 p-8"
        >
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl
              bg-gradient-to-br from-navy to-teal mb-4">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0
                    01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-navy">Reset your password</h1>
            <p className="text-text-secondary text-sm mt-1.5">
              Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-5 px-4 py-3 bg-deadline-urgent/10 border border-deadline-urgent/30
                  rounded-xl text-deadline-urgent text-sm font-medium"
                role="alert"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor={`${uid}-email`} className="block text-sm font-medium text-navy mb-1.5">
                Email address
              </label>
              <input
                id={`${uid}-email`}
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="you@university.edu"
                className="w-full px-4 py-3 rounded-xl border border-border hover:border-navy/30
                  bg-surface-raised text-sm transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-teal/40 focus:border-teal"
              />
            </div>

            <motion.button
              type="submit"
              id="forgot-pw-submit-btn"
              disabled={loading}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3.5 rounded-xl font-semibold text-white text-sm
                bg-gradient-to-r from-navy to-teal hover:from-navy-light hover:to-teal-light
                disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200
                shadow-sm focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Sending…
                </span>
              ) : "Send reset link"}
            </motion.button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Remember your password?{" "}
            <Link href="/login" className="font-semibold text-teal hover:text-teal-dark transition-colors">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
