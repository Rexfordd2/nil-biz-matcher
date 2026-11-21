-- Reproduce the findings before the hardening migrations.
\set athlete '''aaaaaaaa-0000-4000-8000-000000000001'''
\set other '''aaaaaaaa-0000-4000-8000-000000000002'''
\set legacy '''aaaaaaaa-0000-4000-8000-000000000003'''

SELECT security_test.expect('before', 'anon TRUNCATE waitlist', 'ok',
  'anon', NULL, 'TRUNCATE public.waitlist');
SELECT security_test.expect('before', 'anon TRUNCATE anon_sessions', 'ok',
  'anon', NULL, 'TRUNCATE public.anon_sessions');
SELECT security_test.expect('before', 'authenticated TRUNCATE waitlist', 'ok',
  'authenticated', :athlete, 'TRUNCATE public.waitlist');
SELECT security_test.expect('before', 'authenticated TRUNCATE anon_sessions', 'ok',
  'authenticated', :athlete, 'TRUNCATE public.anon_sessions');

SELECT security_test.check('before', 'anon has EXECUTE on handle_new_user()',
  has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE'));
SELECT security_test.check('before', 'authenticated has EXECUTE on handle_new_user()',
  has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE'));
SELECT security_test.expect('before', 'anon direct call handle_new_user() is refused by PostgreSQL', '0A000',
  'anon', NULL, 'SELECT public.handle_new_user()');
SELECT security_test.expect('before', 'authenticated calls update_anon_session_last_seen', 'ok',
  'authenticated', :athlete, $q$SELECT public.update_anon_session_last_seen('probe')$q$);

SELECT security_test.check('before', 'sign-up metadata role is copied unvalidated into profiles.role',
  (SELECT role = 'coach' FROM public.profiles WHERE id = :other));
-- Audited profiles shape: the anon policy exists but is dormant.
SELECT security_test.check('before', 'profiles_anon_insert policy present',
  EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_anon_insert'));
SELECT security_test.check('before', 'anon holds no INSERT privilege on profiles (policy dormant)',
  NOT has_any_column_privilege('anon', 'public.profiles', 'INSERT'));
SELECT security_test.expect('before', 'anon cannot insert profiles', '42501',
  'anon', NULL, format($q$INSERT INTO public.profiles (id, role) VALUES (%L, 'admin')$q$, :legacy));
SELECT security_test.expect('before', 'owner reads own sign-up profile (id-keyed)', 'ok',
  'authenticated', :athlete, $q$DO $d$ BEGIN
     IF (SELECT count(*) FROM public.profiles) <> 1 THEN RAISE EXCEPTION 'expected exactly own row'; END IF;
     END $d$ $q$);
SELECT security_test.expect('before', 'cross-account profile insert denied', '42501',
  'authenticated', :other, format(
    $q$INSERT INTO public.profiles (id, role, full_name) VALUES (%L, 'admin', 'Spoofed')$q$, :legacy));
SELECT security_test.check('before', 'sign-up profiles have user_id = id (generated)',
  NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id IS DISTINCT FROM id));
SELECT security_test.check('before', 'inventory finding: authenticated holds TRUNCATE on profiles',
  has_table_privilege('authenticated', 'public.profiles', 'TRUNCATE'));
SELECT security_test.expect('before', 'authenticated TRUNCATE profiles succeeds at SQL level (rolled back)', 'ok',
  'authenticated', :athlete, 'TRUNCATE public.profiles');
SELECT security_test.expect('before', 'dormant policy goes live if anon is ever granted INSERT (rolled back)', 'ok',
  'postgres', NULL, format($q$GRANT INSERT ON public.profiles TO anon;
     SET LOCAL ROLE anon;
     INSERT INTO public.profiles (id, role, full_name) VALUES (%L, 'admin', 'Anon-chosen')$q$, :legacy));
