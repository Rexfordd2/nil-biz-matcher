-- ============================================================================
-- Supabase Athlete Profiles - Fix/Create Script
-- ============================================================================
-- Run this script in Supabase SQL Editor to create or fix the athlete_profiles
-- table, RLS policies, and triggers. Safe to run multiple times (idempotent).
--
-- Use this if:
-- - The athlete_profiles table doesn't exist
-- - RLS is disabled
-- - Policies are missing or incorrect
-- - The updated_at trigger is missing
--
-- INSTRUCTIONS:
-- 1. Open Supabase Dashboard → SQL Editor
-- 2. Copy/paste this entire script
-- 3. Click "Run" or press Cmd/Ctrl+Enter
-- 4. Verify success with SUPABASE_VERIFICATION_QUERIES.sql
-- ============================================================================

-- ============================================================================
-- SECTION 1: Create table structure
-- ============================================================================

-- Create the athlete_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.athlete_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add comment for documentation
COMMENT ON TABLE public.athlete_profiles IS 
  'Stores athlete profile data as JSONB. One row per user_id. Keyed by auth.users(id).';

-- ============================================================================
-- SECTION 2: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.athlete_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 3: Create or replace the updated_at trigger function
-- ============================================================================

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.set_updated_at() IS 
  'Trigger function to automatically set updated_at to now() on UPDATE';

-- ============================================================================
-- SECTION 4: Create the updated_at trigger
-- ============================================================================

-- Drop existing trigger if present
DROP TRIGGER IF EXISTS trg_athlete_profiles_updated_at ON public.athlete_profiles;

-- Create the trigger
CREATE TRIGGER trg_athlete_profiles_updated_at
  BEFORE UPDATE ON public.athlete_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- SECTION 5: Create RLS Policies
-- ============================================================================

-- Policy 1: SELECT (read own profile)
-- Users can only read their own profile row
DROP POLICY IF EXISTS "Allow users to read own profile" ON public.athlete_profiles;

CREATE POLICY "Allow users to read own profile"
  ON public.athlete_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy 2: INSERT (create own profile)
-- Users can only insert a row with their own user_id
DROP POLICY IF EXISTS "Allow users to insert own profile" ON public.athlete_profiles;

CREATE POLICY "Allow users to insert own profile"
  ON public.athlete_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policy 3: UPDATE (modify own profile)
-- Users can only update their own profile row
DROP POLICY IF EXISTS "Allow users to update own profile" ON public.athlete_profiles;

CREATE POLICY "Allow users to update own profile"
  ON public.athlete_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy 4: DELETE (remove own profile)
-- Users can only delete their own profile row
DROP POLICY IF EXISTS "Allow users to delete own profile" ON public.athlete_profiles;

CREATE POLICY "Allow users to delete own profile"
  ON public.athlete_profiles
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- SECTION 6: Verification output
-- ============================================================================

-- Show table exists with RLS enabled
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Verification Results ===';
  RAISE NOTICE '';
END $$;

-- Check table exists
SELECT 
  'Table exists: ' || CASE WHEN COUNT(*) > 0 THEN '✓ YES' ELSE '✗ NO' END AS status
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'athlete_profiles';

-- Check RLS is enabled
SELECT 
  'RLS enabled: ' || CASE WHEN rowsecurity THEN '✓ YES' ELSE '✗ NO' END AS status
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'athlete_profiles';

-- Count policies
SELECT 
  'Policies count: ' || COUNT(*) || ' (expected: 4)' AS status
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'athlete_profiles';

-- List policies
SELECT 
  '  - ' || cmd || ': ' || policyname AS policy_list
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'athlete_profiles'
ORDER BY cmd, policyname;

-- Check trigger exists
SELECT 
  'Trigger exists: ' || CASE WHEN COUNT(*) > 0 THEN '✓ YES' ELSE '✗ NO' END AS status
FROM pg_trigger
WHERE tgrelid = 'public.athlete_profiles'::regclass
  AND tgname = 'trg_athlete_profiles_updated_at';

-- ============================================================================
-- SECTION 7: Quick test (optional - only run if you want to test)
-- ============================================================================

-- Uncomment the following to test INSERT/UPDATE as the current user
-- This will create or update a test profile for the authenticated user

/*
-- Test: Insert or update a test profile
INSERT INTO public.athlete_profiles (user_id, profile)
VALUES (
  auth.uid(),
  '{"test": true, "created_by": "fix_script", "timestamp": "' || now()::text || '"}'::jsonb
)
ON CONFLICT (user_id) 
DO UPDATE SET 
  profile = EXCLUDED.profile,
  updated_at = now()
RETURNING 
  user_id, 
  created_at, 
  updated_at,
  profile->>'test' as test_value;

-- Test: Verify the test profile exists
SELECT 
  user_id,
  profile->>'test' as test_value,
  profile->>'created_by' as created_by,
  created_at,
  updated_at
FROM public.athlete_profiles
WHERE user_id = auth.uid();
*/

-- ============================================================================
-- Next Steps
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Success! ===';
  RAISE NOTICE '';
  RAISE NOTICE 'The athlete_profiles table is now ready.';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Run SUPABASE_VERIFICATION_QUERIES.sql to verify all details';
  RAISE NOTICE '2. Test the app: log in, edit profile, click Save, refresh page';
  RAISE NOTICE '3. If saves still fail, check the raw Supabase error in debug mode (?debug=1)';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Rollback Instructions (if needed)
-- ============================================================================

-- If you need to completely remove the table and start over:
-- WARNING: This will DELETE ALL athlete profile data!
--
-- DROP TABLE IF EXISTS public.athlete_profiles CASCADE;
--
-- Then re-run this script to recreate from scratch.
-- ============================================================================
