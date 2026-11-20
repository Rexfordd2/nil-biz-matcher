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
SELECT security_test.expect('before', 'anon cannot insert profiles', '42501',
  'anon', NULL, format($q$INSERT INTO public.profiles (id, role) VALUES (%L, 'admin')$q$, :legacy));

DO $$
BEGIN
  IF (SELECT attgenerated = '' FROM pg_attribute
      WHERE attrelid = 'public.profiles'::regclass AND attname = 'user_id') THEN
    PERFORM security_test.expect('before',
      'production shape: authenticated inserts a profile for another account id', 'ok',
      'authenticated', 'aaaaaaaa-0000-4000-8000-000000000002',
      $q$INSERT INTO public.profiles (id, user_id, role, full_name)
         VALUES ('aaaaaaaa-0000-4000-8000-000000000003',
                 'aaaaaaaa-0000-4000-8000-000000000002', 'admin', 'Spoofed')$q$);
    PERFORM security_test.expect('before',
      'production shape: owner cannot read the profile created at sign-up', 'ok',
      'authenticated', 'aaaaaaaa-0000-4000-8000-000000000001',
      $q$DO $d$ BEGIN
         IF (SELECT count(*) FROM public.profiles) <> 0 THEN RAISE EXCEPTION 'visible'; END IF;
         END $d$ $q$);
  END IF;
END $$;
