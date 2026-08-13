"use client";

import { useState, useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/app/lib/supabase";

// ── Password strength calculator ─────────────────────────────
function getPasswordStrength(password: string): {
  score: number; // 0-4
  label: string;
  color: string;
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  // Clamp to 4 bars
  const clamped = Math.min(score, 4);
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];
  const colors = ["#E4572E", "#E4572E", "#E3A008", "#4CAF7D", "#2CA6A4"];
  return { score: clamped, label: labels[clamped], color: colors[clamped] };
}

// ── Field validation ─────────────────────────────────────────
function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include at least one number.";
  return null;
}

// ── Component ─────────────────────────────────────────────────

export default function SignupPage() {
  const router = useRouter();
  const uid = useId();

  const [form, setForm] = useState({ email: "", password: "", confirm: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false); // verification sent state

  const strength = getPasswordStrength(form.password);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear field error on change
    setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    setServerError("");
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!validateEmail(form.email)) errors.email = "Please enter a valid email address.";
    const pwError = validatePassword(form.password);
    if (pwError) errors.password = pwError;
    if (form.confirm !== form.password) errors.confirm = "Passwords do not match.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setServerError("");

    const { error } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      options: {
        // Supabase will send a verification email; redirect URL must be
        // configured in your Supabase Auth → URL Configuration → Site URL.
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (error) {
      console.error("Supabase Auth Error:", error);
      setServerError(`Error: ${error.message}`);
      return;
    }

    setDone(true);
  }

  // ── Success / verification sent screen ──────────────────────
  if (done) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-md text-center"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-teal/10 mb-6">
            <svg className="w-10 h-10 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-navy mb-3">Check your email</h1>
          <p className="text-text-secondary mb-2">
            We've sent a verification link to <strong className="text-navy">{form.email}</strong>.
          </p>
          <p className="text-text-secondary text-sm mb-8">
            Click the link to activate your account. The link expires in 24 hours.
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-navy text-white rounded-xl font-semibold
              hover:bg-navy-light transition-colors duration-200"
          >
            Back to login
          </Link>
        </motion.div>
      </div>
    );
  }

  // ── Signup form ──────────────────────────────────────────────
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="bg-white rounded-2xl shadow-[var(--shadow-lg)] border border-border/60 p-8"
        >
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl
              bg-gradient-to-br from-navy to-teal mb-4">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 14l6.16-3.422A12.083 12.083 0 0121 21H3a12.083 12.083 0 012.84-10.422L12 14z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-navy">Create your account</h1>
            <p className="text-text-secondary text-sm mt-1.5">
              Join thousands of students tracking their scholarships
            </p>
          </div>

          {/* Server error */}
          <AnimatePresence>
            {serverError && (
              <motion.div
                key="server-error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-5 px-4 py-3 bg-deadline-urgent/10 border border-deadline-urgent/30
                  rounded-xl text-deadline-urgent text-sm font-medium"
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
                aria-describedby={fieldErrors.email ? `${uid}-email-err` : undefined}
                aria-invalid={!!fieldErrors.email}
                className={`w-full px-4 py-3 rounded-xl border text-sm transition-all duration-200
                  bg-surface-raised focus:outline-none focus:ring-2 focus:ring-teal/40 focus:border-teal
                  ${fieldErrors.email
                    ? "border-deadline-urgent text-deadline-urgent"
                    : "border-border hover:border-navy/30"
                  }`}
              />
              {fieldErrors.email && (
                <p id={`${uid}-email-err`} className="mt-1.5 text-xs text-deadline-urgent" role="alert">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor={`${uid}-password`} className="block text-sm font-medium text-navy mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id={`${uid}-password`}
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Min. 8 characters"
                  aria-describedby={`${uid}-pw-hint ${fieldErrors.password ? `${uid}-pw-err` : ""}`.trim()}
                  aria-invalid={!!fieldErrors.password}
                  className={`w-full px-4 py-3 pr-12 rounded-xl border text-sm transition-all duration-200
                    bg-surface-raised focus:outline-none focus:ring-2 focus:ring-teal/40 focus:border-teal
                    ${fieldErrors.password
                      ? "border-deadline-urgent"
                      : "border-border hover:border-navy/30"
                    }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted
                    hover:text-navy transition-colors p-1"
                >
                  {showPassword ? (
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7
                          a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242
                          4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953
                          9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132
                          5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542
                          7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Strength meter */}
              {form.password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1" aria-hidden="true">
                    {[1, 2, 3, 4].map((bar) => (
                      <div
                        key={bar}
                        className="h-1 flex-1 rounded-full transition-all duration-300"
                        style={{
                          backgroundColor: bar <= strength.score ? strength.color : "var(--border)",
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: strength.color }}>
                    {strength.label}
                  </p>
                </div>
              )}

              {/* Hint */}
              <p id={`${uid}-pw-hint`} className="mt-1.5 text-xs text-text-muted">
                At least 8 characters, one uppercase letter, and one number.
              </p>
              {fieldErrors.password && (
                <p id={`${uid}-pw-err`} className="mt-1 text-xs text-deadline-urgent" role="alert">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor={`${uid}-confirm`} className="block text-sm font-medium text-navy mb-1.5">
                Confirm password
              </label>
              <input
                id={`${uid}-confirm`}
                name="confirm"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={form.confirm}
                onChange={handleChange}
                placeholder="Repeat your password"
                aria-describedby={fieldErrors.confirm ? `${uid}-confirm-err` : undefined}
                aria-invalid={!!fieldErrors.confirm}
                className={`w-full px-4 py-3 rounded-xl border text-sm transition-all duration-200
                  bg-surface-raised focus:outline-none focus:ring-2 focus:ring-teal/40 focus:border-teal
                  ${fieldErrors.confirm
                    ? "border-deadline-urgent"
                    : "border-border hover:border-navy/30"
                  }`}
              />
              {fieldErrors.confirm && (
                <p id={`${uid}-confirm-err`} className="mt-1.5 text-xs text-deadline-urgent" role="alert">
                  {fieldErrors.confirm}
                </p>
              )}
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              id="signup-submit-btn"
              disabled={loading}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3.5 rounded-xl font-semibold text-white text-sm
                bg-gradient-to-r from-navy to-teal
                hover:from-navy-light hover:to-teal-light
                disabled:opacity-60 disabled:cursor-not-allowed
                transition-all duration-200 shadow-sm
                focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating account…
                </span>
              ) : (
                "Create account"
              )}
            </motion.button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-text-secondary">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-teal hover:text-teal-dark transition-colors">
              Sign in
            </Link>
          </p>
        </motion.div>

        {/* Terms note */}
        <p className="mt-5 text-center text-xs text-text-muted px-4">
          By creating an account you agree to our{" "}
          <span className="text-teal">Terms of Service</span> and{" "}
          <span className="text-teal">Privacy Policy</span>.
        </p>
      </div>
    </div>
  );
}
