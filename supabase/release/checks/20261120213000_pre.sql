-- Snapshot taken in the same transaction, immediately before
-- 20261120213000_revoke_private_intake_truncate.sql. Metadata and counts only.
CREATE TEMP TABLE release_pre_213000 ON COMMIT DROP AS
SELECT
  (SELECT count(*) FROM public.waitlist) AS waitlist_rows,
  (SELECT count(*) FROM public.anon_sessions) AS anon_session_rows,
  (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.tablename, p.policyname)
   FROM pg_policies p
   WHERE p.schemaname = 'public' AND p.tablename IN ('waitlist', 'anon_sessions')) AS policies,
  (SELECT jsonb_agg(jsonb_build_array(c.relname, a.grantor::regrole::text,
            CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END,
            a.privilege_type, a.is_grantable) ORDER BY 1)
   FROM pg_class c, aclexplode(c.relacl) a
   WHERE c.oid IN ('public.waitlist'::regclass, 'public.anon_sessions'::regclass)
     AND a.privilege_type <> 'TRUNCATE') AS non_truncate_acl,
  (SELECT jsonb_agg(jsonb_build_array(relname, relrowsecurity, relforcerowsecurity) ORDER BY relname)
   FROM pg_class
   WHERE oid IN ('public.waitlist'::regclass, 'public.anon_sessions'::regclass)) AS rls,
  has_table_privilege('service_role', 'public.waitlist', 'TRUNCATE')
    AND has_table_privilege('service_role', 'public.anon_sessions', 'TRUNCATE') AS service_truncate;

DO $$
BEGIN
  IF NOT (SELECT service_truncate FROM release_pre_213000) THEN
    RAISE EXCEPTION 'pre: service_role does not hold TRUNCATE on both intake tables; inspect before applying';
  END IF;
END $$;
