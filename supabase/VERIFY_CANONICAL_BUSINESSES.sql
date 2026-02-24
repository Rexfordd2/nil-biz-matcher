-- ============================================================================
-- Canonical Businesses (businesses + user_businesses) Verification
-- ============================================================================
-- Run these queries in Supabase SQL Editor to verify the canonical businesses
-- migration was applied and RLS is correctly configured.
--
-- Insert/update/select for authenticated users is verified by the Node runtime
-- script: npm run diag:biz (scripts/verify-businesses-canonical.mjs)
-- ============================================================================

-- ============================================================================
-- 1) Tables exist
-- ============================================================================
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('businesses', 'user_businesses');
-- Expected: 2 rows (businesses, user_businesses)

-- ============================================================================
-- 2) RLS enabled
-- ============================================================================
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('businesses', 'user_businesses');
-- Expected: rowsecurity = true for both

-- ============================================================================
-- 3) Expected policies exist
-- ============================================================================
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('businesses', 'user_businesses')
ORDER BY tablename, policyname;
-- Expected:
--   businesses: businesses_select_authenticated, businesses_insert_authenticated, businesses_update_authenticated
--   user_businesses: user_businesses_select_own, user_businesses_insert_own, user_businesses_update_own, user_businesses_delete_own

-- Optional: count policies per table
SELECT tablename, COUNT(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('businesses', 'user_businesses')
GROUP BY tablename;
-- Expected: businesses = 3, user_businesses = 4
