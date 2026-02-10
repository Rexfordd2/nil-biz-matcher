-- ============================================================================
-- MINIMAL PATCH: Enable RLS and policies for athlete_profiles
-- ============================================================================
-- Safe to re-run - drops existing policies before creating new ones
-- ============================================================================

-- Enable Row Level Security
ALTER TABLE public.athlete_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any)
DROP POLICY IF EXISTS "Allow users to read own profile" ON public.athlete_profiles;
DROP POLICY IF EXISTS "Allow users to insert own profile" ON public.athlete_profiles;
DROP POLICY IF EXISTS "Allow users to update own profile" ON public.athlete_profiles;
DROP POLICY IF EXISTS "Allow users to delete own profile" ON public.athlete_profiles;

-- SELECT policy: users can read their own row
CREATE POLICY "Allow users to read own profile"
  ON public.athlete_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- INSERT policy: users can insert their own row
CREATE POLICY "Allow users to insert own profile"
  ON public.athlete_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE policy: users can update their own row
CREATE POLICY "Allow users to update own profile"
  ON public.athlete_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- VERIFICATION: Show all policies for athlete_profiles
-- ============================================================================

SELECT * FROM pg_policies WHERE tablename = 'athlete_profiles';
