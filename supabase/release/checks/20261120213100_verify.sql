-- Functional verification for 20261120213100, run separately AFTER it is
-- committed. Everything runs in one transaction that ends in ROLLBACK, so the
-- probe session row and any other effect are discarded. Requires the executing
-- role to be able to SET ROLE anon, authenticated and service_role.
\set ON_ERROR_STOP 1
BEGIN;
SET LOCAL statement_timeout = '30s';

DO $$
DECLARE
  probe constant text := 'release-verify-' || md5(clock_timestamp()::text);
  failures text[] := '{}';
  denied boolean;
  client text;
BEGIN
  -- Anonymous-session RPC available to anon and effective.
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  PERFORM public.update_anon_session_last_seen(probe);
  EXECUTE 'RESET ROLE';
  IF NOT EXISTS (SELECT 1 FROM public.anon_sessions WHERE anon_id = probe) THEN
    failures := failures || 'anon RPC did not record the session'::text;
  END IF;

  -- Authenticated RPC restricted.
  denied := false;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claims',
      '{"role":"authenticated","sub":"00000000-0000-4000-8000-00000000beef"}', true);
    PERFORM public.update_anon_session_last_seen(probe);
    EXECUTE 'RESET ROLE';
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN failures := failures || 'authenticated can call update_anon_session_last_seen'::text; END IF;

  -- Direct calls to the trigger function refused for both client roles.
  FOREACH client IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    denied := false;
    BEGIN
      EXECUTE format('SET LOCAL ROLE %I', client);
      PERFORM public.handle_new_user();
      EXECUTE 'RESET ROLE';
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    WHEN OTHERS THEN
      denied := false;
    END;
    IF NOT denied THEN failures := failures || (client || ' EXECUTE on handle_new_user() not denied'); END IF;
  END LOOP;

  -- Service role keeps the RPC.
  EXECUTE 'SET LOCAL ROLE service_role';
  PERFORM public.update_anon_session_last_seen('release-verify-service');
  EXECUTE 'RESET ROLE';

  IF cardinality(failures) > 0 THEN
    RAISE EXCEPTION 'verification failed: %', array_to_string(failures, '; ');
  END IF;
  RAISE NOTICE 'verification passed: anon RPC ok, authenticated RPC denied, handle_new_user() denied to clients, service_role RPC ok';
END $$;

ROLLBACK;
