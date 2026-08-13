-- ============================================================
-- Migration: Auth Integration, Triggers & RLS Hardening
-- Run this after the init_schema migration.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. Auto-sync Supabase auth.users → public.users on signup
--    This fires when Supabase creates a new auth user so our
--    public.users table always mirrors auth.users.id / email.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER          -- runs with definer privileges (postgres role)
SET search_path = public  -- prevent search_path injection
AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (NEW.id, NEW.email, NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop if exists to allow re-running safely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();


-- ──────────────────────────────────────────────────────────────
-- 2. FORCE RLS — prevents table owner from bypassing policies.
--    This is a database-level control, not just application-level.
--    FORCE ROW LEVEL SECURITY makes RLS apply to ALL roles,
--    including the table owner (postgres).
-- ──────────────────────────────────────────────────────────────

ALTER TABLE public.user_profile FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_scholarships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;


-- ──────────────────────────────────────────────────────────────
-- 3. Ensure policies cover SELECT, INSERT, UPDATE, DELETE
--    individually (safer than FOR ALL in some Postgres versions).
--    Drop and recreate to be idempotent.
-- ──────────────────────────────────────────────────────────────

-- user_profile ------------------------------------------------
DROP POLICY IF EXISTS "Users can only read/write their own profile" ON public.user_profile;

CREATE POLICY "user_profile_select_own" ON public.user_profile
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_profile_insert_own" ON public.user_profile
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_profile_update_own" ON public.user_profile
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_profile_delete_own" ON public.user_profile
  FOR DELETE USING (auth.uid() = user_id);


-- user_scholarships -------------------------------------------
DROP POLICY IF EXISTS "Users can only read/write their own tracked scholarships" ON public.user_scholarships;

CREATE POLICY "user_scholarships_select_own" ON public.user_scholarships
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_scholarships_insert_own" ON public.user_scholarships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_scholarships_update_own" ON public.user_scholarships
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_scholarships_delete_own" ON public.user_scholarships
  FOR DELETE USING (auth.uid() = user_id);


-- ──────────────────────────────────────────────────────────────
-- 4. Service-role bypass for the FastAPI backend
--    The backend uses the service_role key (never exposed to
--    clients). The service_role bypasses RLS by default in
--    Supabase, but we document the intent here explicitly.
--    No additional policy is needed — service_role is already
--    a Supabase-managed superuser.
-- ──────────────────────────────────────────────────────────────

-- (Informational comment — no SQL required for service_role bypass)
-- The FastAPI backend authenticates via the Supabase service_role
-- secret key and validates user JWTs server-side before any DB write.
