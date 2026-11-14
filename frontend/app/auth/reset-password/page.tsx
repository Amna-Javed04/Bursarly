"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

/**
 * /auth/reset-password — landing page for the Supabase recovery link.
 *
 * Supabase redirects here with a `code` that the browser client exchanges for a
 * short-lived session automatically. While the session exists we show the form;
 * without one (expired or reused link) we send the user back to request a new
 * email instead of silently failing.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setHasSession(Boolean(data.session));
      setChecking(false);
    });

    // The client emits this once it finishes parsing the recovery link.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setHasSession(true);
        setChecking(false);
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Both passwords need to match.");
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setDone(true);
    setTimeout(() => router.replace("/login?reset=1"), 1200);
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-16">
      <div className="clay p-7 sm:p-9">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-dark">Account</p>
        <h1 className="mt-3 font-display text-[clamp(1.8rem,4vw,2.4rem)] leading-tight text-navy">
          Set a new password
        </h1>

        {checking ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-text-secondary">
            <span className="h-1.5 w-1.5 bg-teal pulse-dot" />
            Checking your recovery link…
          </p>
        ) : done ? (
          <div className="mt-6">
            <p className="text-sm text-text-secondary">
              Password updated. Taking you to the login page…
            </p>
            <Link href="/login" className="link-sweep mt-4 inline-block text-sm font-medium text-navy">
              Log in now
            </Link>
          </div>
        ) : !hasSession ? (
          <div className="mt-6">
            <p className="text-sm text-text-secondary">
              This recovery link has expired or was already used. Request a fresh one and open it in
              the same browser.
            </p>
            <Link href="/forgot-password" className="link-sweep mt-4 inline-block text-sm font-medium text-navy">
              Send a new reset link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="new-password" className="mb-1.5 block text-[12px] font-medium text-navy">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="clay h-11 w-full px-3 text-sm text-navy outline-none"
                placeholder="At least 8 characters"
                required
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="mb-1.5 block text-[12px] font-medium text-navy">
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="clay h-11 w-full px-3 text-sm text-navy outline-none"
                placeholder="Repeat it"
                required
              />
            </div>

            {error && (
              <p className="border-l-2 border-deadline-urgent bg-deadline-urgent/5 px-3 py-2 text-xs text-deadline-urgent">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="clay-btn w-full bg-navy px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Save new password"}
            </button>
          </form>
        )}
      </div>

      <Link href="/login" className="link-sweep mt-6 self-center text-xs text-text-secondary">
        Back to login
      </Link>
    </div>
  );
}
