-- ============================================================================
-- Supabase Athlete Profiles Verification Queries
-- ============================================================================
-- Run these queries in Supabase SQL Editor to verify the deployed database
-- state matches what the application expects.
-- ============================================================================

-- 1A) Table exists + RLS enabled
-- Expected: One row with rowsecurity = true
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'athlete_profiles';

-- 1B) Column names + types
-- Expected columns:
--   user_id     | uuid                     | NO  | (no default, set by app)
--   profile     | jsonb                    | NO  | '{}'::jsonb
--   created_at  | timestamp with time zone | NO  | now()
--   updated_at  | timestamp with time zone | NO  | now()
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'athlete_profiles'
ORDER BY ordinal_position;

-- 1C) Primary key constraint
-- Expected: user_id is the primary key
SELECT tc.constraint_name, kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'athlete_profiles'
  AND tc.constraint_type = 'PRIMARY KEY';

-- 1D) Foreign key to auth.users
-- Expected: user_id references auth.users(id) with ON DELETE CASCADE
SELECT 
  tc.constraint_name, 
  kcu.column_name, 
  ccu.table_schema AS foreign_schema, 
  ccu.table_name AS foreign_table, 
  ccu.column_name AS foreign_column,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'athlete_profiles'
  AND tc.constraint_type = 'FOREIGN KEY';

-- 1E) RLS Policies
-- Expected 4 policies: SELECT, INSERT, UPDATE, DELETE
-- All must use: user_id = auth.uid()
SELECT 
  policyname, 
  cmd, 
  ARRAY_AGG(roles) AS roles, 
  qual AS using_expression, 
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'athlete_profiles'
GROUP BY policyname, cmd, qual, with_check
ORDER BY cmd, policyname;

-- Expected output:
-- policyname                           | cmd    | roles              | using_expression              | with_check_expression
-- -------------------------------------+--------+-------------------+------------------------------+------------------------------
-- Allow users to delete own profile    | DELETE | {authenticated}   | (user_id = auth.uid())       | NULL
-- Allow users to insert own profile    | INSERT | {authenticated}   | NULL                         | (user_id = auth.uid())
-- Allow users to read own profile      | SELECT | {authenticated}   | (user_id = auth.uid())       | NULL
-- Allow users to update own profile    | UPDATE | {authenticated}   | (user_id = auth.uid())       | (user_id = auth.uid())

-- 1F) Trigger for updated_at
-- Expected: trg_athlete_profiles_updated_at exists
SELECT 
  tgname AS trigger_name, 
  tgrelid::regclass AS table_name,
  proname AS function_name,
  tgtype,
  tgenabled
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'public.athlete_profiles'::regclass
  AND tgname NOT LIKE 'RI_%'; -- exclude internal FK triggers

-- 1G) Check migrations table (if using Supabase migrations)
-- This detects whether Supabase tracks migrations
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema IN ('supabase_migrations', 'public')
  AND table_name LIKE '%migration%'
ORDER BY table_schema, table_name;

-- If migrations table exists, check applied migrations
-- (Adjust table name based on output above)
-- SELECT version, name, inserted_at
-- FROM supabase_migrations.schema_migrations
-- WHERE name LIKE '%athlete%'
-- ORDER BY inserted_at DESC;

-- ============================================================================
-- Quick Health Check (run as authenticated user in app)
-- ============================================================================

-- 1H) Verify auth.uid() works (must return your UUID, not NULL)
SELECT auth.uid() AS current_user_id;

-- 1I) Test SELECT permission (should return your profile or empty set)
SELECT user_id, created_at, updated_at, 
       jsonb_pretty(profile) AS profile_formatted
FROM athlete_profiles
WHERE user_id = auth.uid();

-- 1J) Test INSERT/UPSERT (creates or updates your profile)
INSERT INTO athlete_profiles (user_id, profile)
VALUES (auth.uid(), '{"test": true}'::jsonb)
ON CONFLICT (user_id) 
DO UPDATE SET 
  profile = EXCLUDED.profile,
  updated_at = now()
RETURNING user_id, created_at, updated_at;

-- 1K) Verify the test profile was saved
SELECT user_id, profile->>'test' AS test_value, updated_at
FROM athlete_profiles
WHERE user_id = auth.uid();

-- ============================================================================
-- Troubleshooting Queries
-- ============================================================================

-- Check if table exists but RLS is disabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'athlete_profiles'
  AND rowsecurity = false;
-- If this returns a row, RLS is DISABLED (bad!)

-- Check for orphaned policies (policies on non-existent table)
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename = 'athlete_profiles'
  AND NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = pg_policies.schemaname 
      AND tablename = pg_policies.tablename
  );

-- Count total rows (admin/service role only)
-- SELECT COUNT(*) FROM athlete_profiles;

-- ============================================================================
-- Expected Results Summary
-- ============================================================================
-- 
-- 1A) One row: public | athlete_profiles | true
-- 1B) 4 columns: user_id (uuid), profile (jsonb), created_at, updated_at
-- 1C) Primary key on user_id
-- 1D) Foreign key: user_id -> auth.users(id) with CASCADE
-- 1E) 4 policies (SELECT, INSERT, UPDATE, DELETE) all using auth.uid()
-- 1F) Trigger: trg_athlete_profiles_updated_at
-- 1G) Migrations table exists (optional, depends on setup)
-- 1H) auth.uid() returns a UUID
-- 1I-1K) CRUD operations succeed for authenticated user
--
-- If any query returns empty/unexpected results, the table/policies are
-- missing or misconfigured. Use the fix pack SQL to repair.
-- ============================================================================
