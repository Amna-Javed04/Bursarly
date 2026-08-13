/**
 * /auth/callback — handles the redirect from Supabase after email verification.
 *
 * Supabase sends users here with a `code` query param (PKCE flow) or
 * a `token_hash` + `type` (email OTP / magic-link flow).
 *
 * This route:
 *   1. Exchanges the code for a session using exchangeCodeForSession()
 *   2. On success → redirects to /login?verified=1 so the user sees a
 *      confirmation banner and logs in normally.
 *   3. On error → redirects to /verify-error so the user sees a friendly
 *      "link expired" page.
 *
 * This is a Server Component so there is no client-side JS needed here —
 * the redirect happens server-side via Next.js redirect().
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // In Server Components, cookies().set() is not always available.
              // The middleware will handle the cookie refresh instead.
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Redirect to login page with verified flag — user still needs to sign in
      redirect(`/login?verified=1`);
    }
  }

  // Something went wrong — link expired or already used
  redirect("/verify-error");
}
