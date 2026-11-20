-- Postconditions for 20261120213000, in the same transaction. Any failure
-- raises and the runner rolls back the migration and its ledger row.
DO $$
DECLARE
  pre release_pre_213000%ROWTYPE;
  path record;
BEGIN
  SELECT * INTO pre FROM release_pre_213000;

  IF (SELECT count(*) FROM public.waitlist) <> pre.waitlist_rows
     OR (SELECT count(*) FROM public.anon_sessions) <> pre.anon_session_rows THEN
    RAISE EXCEPTION 'post: intake row counts changed';
  END IF;

  IF (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.tablename, p.policyname)
      FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename IN ('waitlist', 'anon_sessions'))
     IS DISTINCT FROM pre.policies THEN
    RAISE EXCEPTION 'post: intake RLS policies changed';
  END IF;

  IF (SELECT jsonb_agg(jsonb_build_array(relname, relrowsecurity, relforcerowsecurity) ORDER BY relname)
      FROM pg_class
      WHERE oid IN ('public.waitlist'::regclass, 'public.anon_sessions'::regclass))
     IS DISTINCT FROM pre.rls THEN
    RAISE EXCEPTION 'post: intake RLS flags changed';
  END IF;

  IF (SELECT jsonb_agg(jsonb_build_array(c.relname, a.grantor::regrole::text,
            CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END,
            a.privilege_type, a.is_grantable) ORDER BY 1)
      FROM pg_class c, aclexplode(c.relacl) a
      WHERE c.oid IN ('public.waitlist'::regclass, 'public.anon_sessions'::regclass)
        AND a.privilege_type <> 'TRUNCATE')
     IS DISTINCT FROM pre.non_truncate_acl THEN
    RAISE EXCEPTION 'post: a non-TRUNCATE intake privilege changed';
  END IF;

  IF NOT (has_table_privilege('service_role', 'public.waitlist', 'TRUNCATE')
          AND has_table_privilege('service_role', 'public.anon_sessions', 'TRUNCATE')) THEN
    RAISE EXCEPTION 'post: service_role lost TRUNCATE';
  END IF;

  IF NOT (has_table_privilege('anon', 'public.waitlist', 'INSERT')
          AND has_table_privilege('authenticated', 'public.waitlist', 'INSERT')
          AND has_table_privilege('anon', 'public.anon_sessions', 'INSERT')) THEN
    RAISE EXCEPTION 'post: an intake INSERT privilege used by the app is missing';
  END IF;

  FOR path IN
    SELECT api.rolname AS api_role, r.rolname AS via_role, t.tbl
    FROM pg_roles api
    JOIN pg_roles r ON pg_has_role(api.oid, r.oid, 'MEMBER')
    CROSS JOIN (VALUES ('public.waitlist'), ('public.anon_sessions')) AS t(tbl)
    WHERE api.rolname IN ('anon', 'authenticated')
      AND has_table_privilege(r.oid, t.tbl, 'TRUNCATE')
  LOOP
    RAISE EXCEPTION 'post: TRUNCATE on % still reachable by % via %', path.tbl, path.api_role, path.via_role;
  END LOOP;
END $$;
