-- Snapshot taken in the same transaction, immediately before
-- 20261120213100_restrict_security_definer_execute.sql. Metadata only.
CREATE TEMP TABLE release_pre_213100 ON COMMIT DROP AS
SELECT
  (SELECT jsonb_agg(jsonb_build_array(p.oid::regprocedure::text, p.oid::bigint,
            pg_get_userbyid(p.proowner), p.prorettype::regtype::text, p.prosecdef,
            p.provolatile, p.proconfig, md5(p.prosrc)) ORDER BY p.oid)
   FROM pg_proc p
   WHERE p.oid IN ('public.handle_new_user()'::regprocedure,
                   'public.update_anon_session_last_seen(text)'::regprocedure)) AS functions,
  (SELECT jsonb_agg(jsonb_build_array(t.tgrelid::regclass::text, t.tgname, t.tgenabled,
            pg_get_triggerdef(t.oid)) ORDER BY t.tgname)
   FROM pg_trigger t
   WHERE t.tgfoid = 'public.handle_new_user()'::regprocedure) AS signup_triggers,
  has_function_privilege('service_role', 'public.handle_new_user()', 'EXECUTE') AS service_handle_new_user,
  (SELECT count(*) FROM public.profiles) AS profile_rows,
  (SELECT count(*) FROM public.anon_sessions) AS anon_session_rows;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgfoid = 'public.handle_new_user()'::regprocedure
      AND tgrelid = 'auth.users'::regclass
      AND tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'pre: no enabled auth.users trigger calls handle_new_user(); inspect before applying';
  END IF;
  IF NOT (SELECT bool_and(prosecdef) FROM pg_proc
          WHERE oid IN ('public.handle_new_user()'::regprocedure,
                        'public.update_anon_session_last_seen(text)'::regprocedure)) THEN
    RAISE EXCEPTION 'pre: expected both functions to be SECURITY DEFINER';
  END IF;
END $$;
