-- ============================================================================
-- Migration: Create athlete_profiles table with RLS policies
-- ============================================================================
-- This migration ensures the athlete_profiles table exists with proper
-- schema, RLS policies, and triggers. Safe to run multiple times (idempotent).
--
-- Created: 2026-02-03
-- Purpose: Consolidate athlete profile storage with proper authentication
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
-- 4) Create updated_at trigger
-- ============================================================================

DROP TRIGGER IF EXISTS trg_athlete_profiles_updated_at ON public.athlete_profiles;

CREATE TRIGGER trg_athlete_profiles_updated_at
  BEFORE UPDATE ON public.athlete_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 5) Create RLS Policies
-- ============================================================================

-- SELECT policy: users can read their own profile
DROP POLICY IF EXISTS "Allow users to read own profile" ON public.athlete_profiles;

CREATE POLICY "Allow users to read own profile"
  ON public.athlete_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT policy: users can insert their own profile
DROP POLICY IF EXISTS "Allow users to insert own profile" ON public.athlete_profiles;

CREATE POLICY "Allow users to insert own profile"
  ON public.athlete_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE policy: users can update their own profile
DROP POLICY IF EXISTS "Allow users to update own profile" ON public.athlete_profiles;

CREATE POLICY "Allow users to update own profile"
  ON public.athlete_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE policy: users can delete their own profile
DROP POLICY IF EXISTS "Allow users to delete own profile" ON public.athlete_profiles;

CREATE POLICY "Allow users to delete own profile"
  ON public.athlete_profiles
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- 6) Create index on user_id (already covered by primary key, but explicit)
-- ============================================================================

-- Primary key already creates an index on user_id, so this is redundant
-- but kept for documentation purposes
-- CREATE INDEX IF NOT EXISTS idx_athlete_profiles_user_id 
--   ON public.athlete_profiles(user_id);

-- ============================================================================
-- Verification
-- ============================================================================

-- After running this migration, verify with:
--
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE schemaname = 'public' AND tablename = 'athlete_profiles';
--
-- SELECT policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'athlete_profiles'
-- ORDER BY cmd, policyname;
--
-- Expected: 4 policies (DELETE, INSERT, SELECT, UPDATE)
-- ============================================================================
