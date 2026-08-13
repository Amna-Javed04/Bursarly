/**
 * Supabase browser client — singleton pattern to avoid multiple GoTrue instances.
 *
 * Configuration pulled from environment variables:
 *   NEXT_PUBLIC_SUPABASE_URL       — your Supabase project URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY  — your Supabase anon/public key (safe to expose)
 *
 * The anon key is NOT a secret — it is subject to RLS policies enforced at the
 * database level. The service-role key (secret) is ONLY used in backend code.
 */

import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. " +
      "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local"
  );
}

// createBrowserClient handles cookie-based session storage (SSR-compatible)
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
