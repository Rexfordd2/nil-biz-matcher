-- Assertions after the hardening migrations.
\set athlete '''aaaaaaaa-0000-4000-8000-000000000001'''
\set other '''aaaaaaaa-0000-4000-8000-000000000002'''
\set legacy '''aaaaaaaa-0000-4000-8000-000000000003'''

-- Phase 1: TRUNCATE removed from client roles, everything else preserved.
SELECT security_test.expect('after', 'anon TRUNCATE waitlist denied', '42501',
  'anon', NULL, 'TRUNCATE public.waitlist');
SELECT security_test.expect('after', 'anon TRUNCATE anon_sessions denied', '42501',
  'anon', NULL, 'TRUNCATE public.anon_sessions');
SELECT security_test.expect('after', 'authenticated TRUNCATE waitlist denied', '42501',
  'authenticated', :athlete, 'TRUNCATE public.waitlist');
SELECT security_test.expect('after', 'authenticated TRUNCATE anon_sessions denied', '42501',
  'authenticated', :athlete, 'TRUNCATE public.anon_sessions');
SELECT security_test.expect('after', 'authenticator (API login) cannot TRUNCATE via SET ROLE anon', '42501',
  'authenticator', NULL, 'SET LOCAL ROLE anon; TRUNCATE public.waitlist');
SELECT security_test.expect('after', 'service_role TRUNCATE still allowed (rolled back)', 'ok',
  'service_role', NULL, 'TRUNCATE public.waitlist, public.anon_sessions');

SELECT security_test.expect('after', 'anon waitlist insert still allowed', 'ok',
  'anon', NULL, $q$INSERT INTO public.waitlist (email, source) VALUES ('probe-anon@example.invalid', 'probe')$q$);
SELECT security_test.expect('after', 'authenticated waitlist insert still allowed', 'ok',
  'authenticated', :athlete, $q$INSERT INTO public.waitlist (email, source) VALUES ('probe-auth@example.invalid', 'probe')$q$);
SELECT security_test.expect('after', 'anon anon_sessions insert still allowed', 'ok',
  'anon', NULL, $q$INSERT INTO public.anon_sessions (anon_id) VALUES ('probe-session')$q$);
SELECT security_test.expect('after', 'anon still reads 0 waitlist / anon_sessions rows', 'ok',
  'anon', NULL, $q$DO $d$ BEGIN
     IF (SELECT count(*) FROM public.waitlist) + (SELECT count(*) FROM public.anon_sessions) <> 0
     THEN RAISE EXCEPTION 'private intake rows visible'; END IF; END $d$ $q$);
SELECT security_test.expect('after', 'authenticated still reads 0 waitlist / anon_sessions rows', 'ok',
  'authenticated', :athlete, $q$DO $d$ BEGIN
     IF (SELECT count(*) FROM public.waitlist) + (SELECT count(*) FROM public.anon_sessions) <> 0
     THEN RAISE EXCEPTION 'private intake rows visible'; END IF; END $d$ $q$);
SELECT security_test.expect('after', 'service_role still reads every intake row', 'ok',
  'service_role', NULL, format($q$DO $d$ BEGIN
     IF (SELECT count(*) FROM public.waitlist) <> %s
        OR (SELECT count(*) FROM public.anon_sessions) <> %s
     THEN RAISE EXCEPTION 'service_role intake count changed'; END IF; END $d$ $q$,
     (SELECT waitlist_rows FROM security_test.baseline),
     (SELECT anon_session_rows FROM security_test.baseline)));

SELECT security_test.check('after', 'stored waitlist rows preserved',
  (SELECT count(*) FROM public.waitlist) = (SELECT waitlist_rows FROM security_test.baseline));
SELECT security_test.check('after', 'stored anon_sessions rows preserved',
  (SELECT count(*) FROM public.anon_sessions) = (SELECT anon_session_rows FROM security_test.baseline));
SELECT security_test.check('after', 'waitlist / anon_sessions policies unchanged',
  (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.tablename, p.policyname)
   FROM pg_policies p WHERE p.tablename IN ('waitlist', 'anon_sessions'))
  = (SELECT intake_policies FROM security_test.baseline));
SELECT security_test.check('after', 'no authenticated SELECT/ALL policy returned on intake tables',
  NOT EXISTS (SELECT 1 FROM pg_policies
              WHERE tablename IN ('waitlist', 'anon_sessions')
                AND cmd IN ('SELECT', 'ALL') AND 'authenticated' = ANY (roles)));
SELECT security_test.check('after', 'all non-TRUNCATE table privileges unchanged',
  (SELECT jsonb_agg(to_jsonb(a) ORDER BY a) FROM (
     SELECT 'waitlist' AS tbl, * FROM security_test.non_truncate_acl('public.waitlist')
     UNION ALL
     SELECT 'anon_sessions', * FROM security_test.non_truncate_acl('public.anon_sessions')
   ) a) = (SELECT intake_non_truncate_acl FROM security_test.baseline));
SELECT security_test.check('after', 'service_role TRUNCATE privilege unchanged',
  (has_table_privilege('service_role', 'public.waitlist', 'TRUNCATE')
   AND has_table_privilege('service_role', 'public.anon_sessions', 'TRUNCATE'))
  = (SELECT service_truncate FROM security_test.baseline));

-- Phase 2: SECURITY DEFINER EXECUTE.
SELECT security_test.check('after', 'anon has no EXECUTE on handle_new_user()',
  NOT has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE'));
SELECT security_test.check('after', 'authenticated has no EXECUTE on handle_new_user()',
  NOT has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE'));
SELECT security_test.expect('after', 'anon direct call handle_new_user() denied', '42501',
  'anon', NULL, 'SELECT public.handle_new_user()');
SELECT security_test.expect('after', 'sign-up still creates the profile through the trigger', 'ok',
  'supabase_auth_admin', NULL, $q$DO $d$ BEGIN
     INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
       ('aaaaaaaa-0000-4000-8000-000000000009', 'synthetic-new@example.invalid',
        '{"role":"parent","full_name":"Synthetic New"}');
     END $d$;
     RESET ROLE;
     DO $d$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM public.profiles
                      WHERE id = 'aaaaaaaa-0000-4000-8000-000000000009' AND role = 'parent'
                        AND user_id = id)
       THEN RAISE EXCEPTION 'trigger did not create profile with generated user_id'; END IF;
     END $d$ $q$);
SELECT security_test.expect('after', 'anon session RPC still works', 'ok',
  'anon', NULL, $q$SELECT public.update_anon_session_last_seen('5e5e5e5e-0000-4000-8000-000000000001')$q$);
SELECT security_test.expect('after', 'anon session RPC still creates a new session', 'ok',
  'anon', NULL, $q$SELECT public.update_anon_session_last_seen('5e5e5e5e-0000-4000-8000-0000000000ff');
     RESET ROLE;
     DO $d$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM public.anon_sessions
                      WHERE anon_id = '5e5e5e5e-0000-4000-8000-0000000000ff')
       THEN RAISE EXCEPTION 'session not created'; END IF;
     END $d$ $q$);
SELECT security_test.expect('after', 'authenticated session RPC denied', '42501',
  'authenticated', :athlete, $q$SELECT public.update_anon_session_last_seen('probe')$q$);
SELECT security_test.expect('after', 'service_role session RPC allowed', 'ok',
  'service_role', NULL, $q$SELECT public.update_anon_session_last_seen('probe')$q$);

-- Phase 3: dormant profiles_anon_insert removed; nothing else on profiles moves.
SELECT security_test.check('after', 'profiles_anon_insert removed',
  NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_anon_insert'));
SELECT security_test.check('after', 'authenticated id-keyed INSERT/SELECT/UPDATE policies unchanged',
  (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.policyname) FROM pg_policies p WHERE p.tablename = 'profiles')
  = (SELECT profiles_owner_policies FROM security_test.baseline));
SELECT security_test.check('after', 'no DELETE or ALL policy on profiles',
  NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND cmd IN ('DELETE', 'ALL')));
SELECT security_test.check('after', 'profiles grants unchanged (incl. authenticated TRUNCATE, out of scope)',
  (SELECT to_jsonb(relacl::text[]) FROM pg_class WHERE oid = 'public.profiles'::regclass)
  = (SELECT profiles_acl FROM security_test.baseline));
SELECT security_test.check('after', 'profiles triggers unchanged',
  (SELECT coalesce(jsonb_agg(jsonb_build_array(tgname, tgenabled, pg_get_triggerdef(oid)) ORDER BY tgname), '[]')
   FROM pg_trigger WHERE tgrelid = 'public.profiles'::regclass AND NOT tgisinternal)
  = (SELECT profiles_triggers FROM security_test.baseline));
SELECT security_test.check('after', 'profiles constraints and foreign keys unchanged',
  (SELECT coalesce(jsonb_agg(jsonb_build_array(conname, pg_get_constraintdef(oid)) ORDER BY conname), '[]')
   FROM pg_constraint WHERE conrelid = 'public.profiles'::regclass)
  = (SELECT profiles_constraints FROM security_test.baseline));
SELECT security_test.check('after', 'profiles columns unchanged; user_id still stored generated',
  (SELECT jsonb_agg(jsonb_build_array(a.attname, a.attgenerated, pg_get_expr(d.adbin, d.adrelid)) ORDER BY a.attnum)
   FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
   WHERE a.attrelid = 'public.profiles'::regclass AND a.attnum > 0 AND NOT a.attisdropped)
  = (SELECT profiles_columns FROM security_test.baseline)
  AND (SELECT attgenerated = 's' FROM pg_attribute
       WHERE attrelid = 'public.profiles'::regclass AND attname = 'user_id'));
SELECT security_test.check('after', 'stored profile rows identical',
  (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM public.profiles p)
  = (SELECT profiles_rows FROM security_test.baseline));
SELECT security_test.expect('after', 'a future anon INSERT grant no longer admits rows (rolled back)', '42501',
  'postgres', NULL, format($q$GRANT INSERT ON public.profiles TO anon;
     SET LOCAL ROLE anon;
     INSERT INTO public.profiles (id, role, full_name) VALUES (%L, 'admin', 'Anon-chosen')$q$, :legacy));
SELECT security_test.check('after', 'anon still holds no INSERT privilege on profiles',
  NOT has_any_column_privilege('anon', 'public.profiles', 'INSERT'));
SELECT security_test.expect('after', 'owner reads own sign-up profile', 'ok',
  'authenticated', :athlete, $q$DO $d$ BEGIN
     IF (SELECT count(*) FROM public.profiles) <> 1 THEN RAISE EXCEPTION 'expected exactly own row'; END IF;
     END $d$ $q$);
SELECT security_test.expect('after', 'owner cannot delete own profile (no DELETE policy)', 'ok',
  'authenticated', :athlete, $q$DO $d$ DECLARE n int; BEGIN
     DELETE FROM public.profiles; GET DIAGNOSTICS n = ROW_COUNT;
     IF n <> 0 THEN RAISE EXCEPTION 'deleted % rows', n; END IF; END $d$ $q$);
SELECT security_test.expect('after', 'cross-account profile insert denied', '42501',
  'authenticated', :other, format(
    $q$INSERT INTO public.profiles (id, role, full_name) VALUES (%L, 'admin', 'Spoofed')$q$, :legacy));
SELECT security_test.expect('after', 'anon profile insert denied', '42501',
  'anon', NULL, format($q$INSERT INTO public.profiles (id, role) VALUES (%L, 'admin')$q$, :legacy));
SELECT security_test.expect('after', 'account without a profile may create its own', 'ok',
  'authenticated', :legacy, format(
    $q$INSERT INTO public.profiles (id, role, full_name) VALUES (%L, 'athlete', 'Legacy')$q$, :legacy));
SELECT security_test.expect('after', 'owner updates own display name', 'ok',
  'authenticated', :athlete, $q$DO $d$ DECLARE n int; BEGIN
     UPDATE public.profiles SET display_name = 'Renamed'; GET DIAGNOSTICS n = ROW_COUNT;
     IF n <> 1 THEN RAISE EXCEPTION 'updated % rows', n; END IF; END $d$ $q$);
SELECT security_test.expect('after', 'owner cannot move own row to another account id', '42501',
  'authenticated', :athlete, format(
    $q$UPDATE public.profiles SET id = %L WHERE id = %L$q$, :legacy, :athlete));
SELECT security_test.expect('after', 'owner cannot update another account profile', 'ok',
  'authenticated', :athlete, format($q$DO $d$ DECLARE n int; BEGIN
     UPDATE public.profiles SET role = 'admin' WHERE id = %L; GET DIAGNOSTICS n = ROW_COUNT;
     IF n <> 0 THEN RAISE EXCEPTION 'updated another account'; END IF; END $d$ $q$, :other));
SELECT security_test.check('after', 'stored profile rows preserved',
  (SELECT count(*) FROM public.profiles) = (SELECT profile_rows FROM security_test.baseline));
