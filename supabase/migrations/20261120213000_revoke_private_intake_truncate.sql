-- Row policies do not govern TRUNCATE. Remove it from the client API roles on
-- the private intake tables. Rows, policies, INSERT/SELECT grants, and
-- service_role access are unchanged.
DO $$
BEGIN
  IF to_regclass('public.waitlist') IS NULL
     OR to_regclass('public.anon_sessions') IS NULL THEN
    RAISE EXCEPTION 'Private intake tables missing; inspect before applying';
  END IF;
END $$;

REVOKE TRUNCATE ON TABLE public.waitlist, public.anon_sessions
  FROM PUBLIC, anon, authenticated;

-- REVOKE only removes grants made by the executing role and only from the named
-- roles. Fail (and roll back) if TRUNCATE is still reachable through another
-- grantor, PUBLIC, or any role anon/authenticated belong to (SET ROLE paths
-- count, even for NOINHERIT roles).
DO $$
DECLARE
  path record;
BEGIN
  FOR path IN
    SELECT api.rolname AS api_role, r.rolname AS via_role, t.tbl
    FROM (VALUES ('anon'), ('authenticated')) AS api(rolname)
    JOIN pg_roles r ON pg_has_role(api.rolname, r.oid, 'MEMBER')
    CROSS JOIN (VALUES ('public.waitlist'), ('public.anon_sessions')) AS t(tbl)
    WHERE has_table_privilege(r.oid, t.tbl, 'TRUNCATE')
  LOOP
    RAISE EXCEPTION 'TRUNCATE on % still reachable by % via %; inspect grantors and memberships',
      path.tbl, path.api_role, path.via_role;
  END LOOP;
END $$;
