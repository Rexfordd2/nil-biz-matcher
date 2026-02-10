-- ============================================================================
-- Athlete Profiles RLS Verification and Patching Script
-- ============================================================================
-- This script verifies and ensures all necessary RLS policies exist for the
-- athlete_profiles table to work with the updated useAutosaveProfile hook.
--
-- USAGE:
-- 1. Run the verification queries first to check current state
-- 2. If policies are missing, run the CREATE POLICY statements
-- 3. Run verification queries again to confirm
-- ============================================================================

-- ============================================================================
-- VERIFICATION QUERIES (Run these first)
-- ============================================================================

-- Check if RLS is enabled on athlete_profiles
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'athlete_profiles';
-- Expected: rowsecurity = true

-- List all policies on athlete_profiles
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'athlete_profiles'
ORDER BY policyname;
-- Expected: 4 policies (select, insert, update, delete)

-- Check specific policies exist
SELECT COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'athlete_profiles'
  AND policyname IN (
    'Allow users to read own profile',
    'Allow users to insert own profile', 
    'Allow users to update own profile',
    'Allow users to delete own profile'
  );
-- Expected: 4

-- ============================================================================
-- PATCH: Ensure table exists and RLS is enabled
-- ============================================================================

-- Create table if not exists (idempotent)
CREATE TABLE IF NOT EXISTS public.athlete_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.athlete_profiles ENABLE ROW LEVEL SECURITY;

-- Ensure updated_at trigger exists
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_athlete_profiles_updated_at ON public.athlete_profiles;
CREATE TRIGGER trg_athlete_profiles_updated_at
BEFORE UPDATE ON public.athlete_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- PATCH: Create or replace all RLS policies
-- ============================================================================

-- SELECT policy
DROP POLICY IF EXISTS "Allow users to read own profile" ON public.athlete_profiles;
CREATE POLICY "Allow users to read own profile"
  ON public.athlete_profiles
  FOR SELECT
  USING (user_id = auth.uid());

-- INSERT policy
DROP POLICY IF EXISTS "Allow users to insert own profile" ON public.athlete_profiles;
CREATE POLICY "Allow users to insert own profile"
  ON public.athlete_profiles
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE policy
DROP POLICY IF EXISTS "Allow users to update own profile" ON public.athlete_profiles;
CREATE POLICY "Allow users to update own profile"
  ON public.athlete_profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE policy
DROP POLICY IF EXISTS "Allow users to delete own profile" ON public.athlete_profiles;
CREATE POLICY "Allow users to delete own profile"
  ON public.athlete_profiles
  FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- VERIFICATION: Test queries (run as authenticated user)
-- ============================================================================

-- Test 1: Select own profile (should succeed when logged in)
-- SELECT * FROM athlete_profiles WHERE user_id = auth.uid();

-- Test 2: Insert own profile (should succeed when logged in)
-- INSERT INTO athlete_profiles (user_id, profile)
-- VALUES (auth.uid(), '{"test": true}'::jsonb)
-- ON CONFLICT (user_id) DO NOTHING;

-- Test 3: Update own profile (should succeed when logged in)
-- UPDATE athlete_profiles
-- SET profile = '{"test": "updated"}'::jsonb
-- WHERE user_id = auth.uid();

-- Test 4: Verify row exists for current user
-- SELECT user_id, updated_at, profile
-- FROM athlete_profiles
-- WHERE user_id = auth.uid();

-- Test 5: Try to access another user's profile (should return empty)
-- SELECT * FROM athlete_profiles WHERE user_id != auth.uid();
-- Expected: 0 rows (RLS blocks access)

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================

-- If saves are failing, check for permission errors:
-- 1. Verify user is authenticated: SELECT auth.uid();
--    - Should return a UUID, not NULL
-- 2. Check if row exists: SELECT COUNT(*) FROM athlete_profiles WHERE user_id = auth.uid();
-- 3. Try manual upsert:
--    INSERT INTO athlete_profiles (user_id, profile)
--    VALUES (auth.uid(), '{}'::jsonb)
--    ON CONFLICT (user_id) DO UPDATE SET profile = EXCLUDED.profile;
-- 4. If error persists, check Supabase logs for detailed error messages

-- Common error codes:
-- - 42501: Permission denied (RLS policy violation)
-- - PGRST301: JWT token invalid/expired
-- - 23503: Foreign key violation (user doesn't exist in auth.users)

-- ============================================================================
-- CLEANUP (ONLY IF NEEDED - removes all data!)
-- ============================================================================

-- WARNING: This will delete all athlete profile data!
-- Uncomment only if you need to start fresh:
-- DROP TABLE IF EXISTS public.athlete_profiles CASCADE;
