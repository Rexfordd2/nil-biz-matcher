-- Postconditions for 20261120213100, in the same transaction. Any failure
-- raises and the runner rolls back the migration and its ledger row.
DO $$
DECLARE
  pre release_pre_213100%ROWTYPE;
  path record;
BEGIN
  SELECT * INTO pre FROM release_pre_213100;

  -- Same function objects, owners, security mode, settings and bodies.
  IF (SELECT jsonb_agg(jsonb_build_array(p.oid::regprocedure::text, p.oid::bigint,
            pg_get_userbyid(p.proowner), p.prorettype::regtype::text, p.prosecdef,
            p.provolatile, p.proconfig, md5(p.prosrc)) ORDER BY p.oid)
      FROM pg_proc p
      WHERE p.oid IN ('public.handle_new_user()'::regprocedure,
                      'public.update_anon_session_last_seen(text)'::regprocedure))
     IS DISTINCT FROM pre.functions THEN
    RAISE EXCEPTION 'post: function identity, owner, settings or body changed';
  END IF;

  -- Trigger-based sign-up still bound and enabled.
  IF (SELECT jsonb_agg(jsonb_build_array(t.tgrelid::regclass::text, t.tgname, t.tgenabled,
            pg_get_triggerdef(t.oid)) ORDER BY t.tgname)
      FROM pg_trigger t
      WHERE t.tgfoid = 'public.handle_new_user()'::regprocedure)
     IS DISTINCT FROM pre.signup_triggers THEN
    RAISE EXCEPTION 'post: sign-up trigger binding changed';
  END IF;

  -- Anonymous-session RPC available to anon; service role keeps both.
  IF NOT has_function_privilege('anon', 'public.update_anon_session_last_seen(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'post: anon cannot EXECUTE update_anon_session_last_seen(text)';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.update_anon_session_last_seen(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'post: service_role cannot EXECUTE update_anon_session_last_seen(text)';
  END IF;
  IF has_function_privilege('service_role', 'public.handle_new_user()', 'EXECUTE')
     IS DISTINCT FROM pre.service_handle_new_user THEN
    RAISE EXCEPTION 'post: service_role EXECUTE on handle_new_user() changed';
  END IF;

  -- No PUBLIC entry left on either ACL.
  IF EXISTS (
    SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a
    WHERE p.oid IN ('public.handle_new_user()'::regprocedure,
                    'public.update_anon_session_last_seen(text)'::regprocedure)
      AND a.grantee = 0
  ) OR EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid IN ('public.handle_new_user()'::regprocedure,
                  'public.update_anon_session_last_seen(text)'::regprocedure)
      AND proacl IS NULL
  ) THEN
    RAISE EXCEPTION 'post: PUBLIC can still EXECUTE a SECURITY DEFINER helper';
  END IF;

  -- No client EXECUTE path, direct or through any reachable role.
  FOR path IN
    SELECT f.api, r.rolname AS via_role, f.fn
    FROM (VALUES
      ('anon', 'public.handle_new_user()'),
      ('authenticated', 'public.handle_new_user()'),
      ('authenticated', 'public.update_anon_session_last_seen(text)')
    ) AS f(api, fn)
    JOIN pg_roles api ON api.rolname = f.api
    JOIN pg_roles r ON pg_has_role(api.oid, r.oid, 'MEMBER')
    WHERE has_function_privilege(r.oid, f.fn, 'EXECUTE')
  LOOP
    RAISE EXCEPTION 'post: EXECUTE on % reachable by % via %', path.fn, path.api, path.via_role;
  END LOOP;

  IF (SELECT count(*) FROM public.profiles) <> pre.profile_rows
     OR (SELECT count(*) FROM public.anon_sessions) <> pre.anon_session_rows THEN
    RAISE EXCEPTION 'post: row counts changed';
  END IF;
END $$;
