-- handle_new_user() only runs as the auth.users insert trigger. Trigger firing
-- does not check EXECUTE, so no client role needs it.
-- update_anon_session_last_seen(text) is called over RPC by signed-out visitors
-- (anon) only. Function bodies are unchanged.
DO $$
BEGIN
  IF to_regprocedure('public.handle_new_user()') IS NULL
     OR to_regprocedure('public.update_anon_session_last_seen(text)') IS NULL THEN
    RAISE EXCEPTION 'SECURITY DEFINER function preflight failed; inspect before applying';
  END IF;
  IF (SELECT prorettype <> 'trigger'::regtype
      FROM pg_proc WHERE oid = 'public.handle_new_user()'::regprocedure) THEN
    RAISE EXCEPTION 'handle_new_user() is no longer a trigger function; inspect before applying';
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_anon_session_last_seen(text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.update_anon_session_last_seen(text) TO anon, service_role;

DO $$
DECLARE
  path record;
BEGIN
  FOR path IN
    SELECT api.rolname AS api_role, r.rolname AS via_role, f.fn
    FROM (VALUES
      ('anon', 'public.handle_new_user()'),
      ('authenticated', 'public.handle_new_user()'),
      ('authenticated', 'public.update_anon_session_last_seen(text)')
    ) AS f(api, fn)
    JOIN pg_roles api ON api.rolname = f.api
    JOIN pg_roles r ON pg_has_role(api.oid, r.oid, 'MEMBER')
    WHERE has_function_privilege(r.oid, f.fn, 'EXECUTE')
  LOOP
    RAISE EXCEPTION 'EXECUTE on % still reachable by % via %; inspect grantors and memberships',
      path.fn, path.api_role, path.via_role;
  END LOOP;
  IF NOT has_function_privilege('anon', 'public.update_anon_session_last_seen(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon lost EXECUTE on update_anon_session_last_seen(text)';
  END IF;
END $$;
