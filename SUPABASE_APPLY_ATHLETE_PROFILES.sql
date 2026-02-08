-- ============================================================================
-- ONE-PASTE SQL: Apply athlete_profiles table and policies
-- ============================================================================
-- SAFE TO RE-RUN: This script is idempotent and can be executed multiple times
-- 
-- Purpose: Create athlete_profiles table with RLS policies for authenticated users
-- Usage: Copy and paste this entire file into Supabase SQL Editor and execute
-- ============================================================================

-- ============================================================================
-- 1) Create table (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.athlete_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2) Enable RLS
-- ============================================================================

ALTER TABLE public.athlete_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3) Create updated_at trigger function (if not exists)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 4) Drop and recreate updated_at trigger
-- ============================================================================

DROP TRIGGER IF EXISTS trg_athlete_profiles_updated_at ON public.athlete_profiles;

CREATE TRIGGER trg_athlete_profiles_updated_at
  BEFORE UPDATE ON public.athlete_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 5) Drop existing policies (safe to re-run)
-- ============================================================================

DROP POLICY IF EXISTS "Allow users to read own profile" ON public.athlete_profiles;
DROP POLICY IF EXISTS "Allow users to insert own profile" ON public.athlete_profiles;
DROP POLICY IF EXISTS "Allow users to update own profile" ON public.athlete_profiles;
DROP POLICY IF EXISTS "Allow users to delete own profile" ON public.athlete_profiles;

-- ============================================================================
-- 6) Create RLS Policies
-- ============================================================================

-- SELECT policy: users can read their own profile
CREATE POLICY "Allow users to read own profile"
  ON public.athlete_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT policy: users can insert their own profile
CREATE POLICY "Allow users to insert own profile"
  ON public.athlete_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE policy: users can update their own profile
CREATE POLICY "Allow users to update own profile"
  ON public.athlete_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE policy: users can delete their own profile
CREATE POLICY "Allow users to delete own profile"
  ON public.athlete_profiles
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- Verification Query (run after execution to verify)
-- ============================================================================

-- Check table and RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'athlete_profiles';

-- Check policies (should return 4 rows: DELETE, INSERT, SELECT, UPDATE)
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'athlete_profiles'
ORDER BY cmd, policyname;

-- Check table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'athlete_profiles'
ORDER BY ordinal_position;

-- ============================================================================
-- Expected Results:
-- ============================================================================
-- Table: athlete_profiles with rowsecurity = true
-- Policies: 4 total (DELETE, INSERT, SELECT, UPDATE) all for 'authenticated' role
-- Columns: user_id (uuid), profile (jsonb), created_at, updated_at (both timestamptz)
-- ============================================================================
