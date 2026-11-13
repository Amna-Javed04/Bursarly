"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function VerifyErrorPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md text-center"
      >
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full
          bg-deadline-urgent/10 mb-6">
          <svg
            className="w-10 h-10 text-deadline-urgent"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667
                1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34
                16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-navy mb-3">Verification link expired</h1>
        <p className="text-text-secondary mb-2">
          This email verification link has expired or has already been used.
        </p>
        <p className="text-text-secondary text-sm mb-8">
          Sign in below and we&apos;ll prompt you to resend a fresh verification email.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/login"
            id="verify-error-login-btn"
            className="px-6 py-3 bg-navy text-white rounded-xl font-semibold text-sm
              hover:bg-navy-light transition-colors duration-200 shadow-sm"
          >
            Go to login
          </Link>
          <Link
            href="/signup"
            id="verify-error-signup-btn"
            className="px-6 py-3 bg-white border border-border text-navy rounded-xl
              font-semibold text-sm hover:bg-surface-raised transition-colors duration-200"
          >
            Create new account
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
