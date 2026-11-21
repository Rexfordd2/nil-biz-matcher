-- Audited production shape of public.profiles (2026-11-20 preflight):
--   * user_id is a stored generated column (= id)
--   * authenticated owner policies keyed on id: profiles_insert_own,
--     profiles_select_own, profiles_update_own; no DELETE policy
--   * a dormant profiles_anon_insert policy; anon holds no INSERT privilege
--   * authenticated still holds TRUNCATE (Supabase default ALL)
-- Synthetic and disposable only.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.profiles ADD COLUMN user_id uuid GENERATED ALWAYS AS (id) STORED;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_anon_insert ON public.profiles
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

REVOKE INSERT ON public.profiles FROM PUBLIC, anon;
GRANT ALL ON public.profiles TO authenticated, service_role;
