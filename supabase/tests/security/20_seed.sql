-- Synthetic accounts and intake rows created through the same roles production
-- uses: the auth admin role for sign-up, anon/authenticated for intake.
SET ROLE supabase_auth_admin;
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'synthetic-athlete@example.invalid',
   '{"role":"athlete","full_name":"Synthetic Athlete"}'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'synthetic-other@example.invalid',
   '{"role":"coach","full_name":"Synthetic Other"}');
RESET ROLE;

-- An account with no profile row, like accounts created before the trigger.
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000003', 'synthetic-legacy@example.invalid');
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

SET ROLE anon;
INSERT INTO public.waitlist (email, source) VALUES ('synthetic-anon@example.invalid', 'security-test');
SELECT public.update_anon_session_last_seen('5e5e5e5e-0000-4000-8000-000000000001');
INSERT INTO public.anon_sessions (anon_id) VALUES ('5e5e5e5e-0000-4000-8000-000000000002');
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"aaaaaaaa-0000-4000-8000-000000000001"}', false);
INSERT INTO public.waitlist (email, source) VALUES ('synthetic-athlete@example.invalid', 'security-test');
RESET ROLE;
SELECT set_config('request.jwt.claims', '', false);

CREATE TABLE security_test.baseline AS
SELECT
  (SELECT count(*) FROM public.waitlist) AS waitlist_rows,
  (SELECT count(*) FROM public.anon_sessions) AS anon_session_rows,
  (SELECT count(*) FROM public.profiles) AS profile_rows,
  (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.tablename, p.policyname)
   FROM pg_policies p WHERE p.tablename IN ('waitlist', 'anon_sessions')) AS intake_policies,
  (SELECT jsonb_agg(to_jsonb(a) ORDER BY a) FROM (
     SELECT 'waitlist' AS tbl, * FROM security_test.non_truncate_acl('public.waitlist')
     UNION ALL
     SELECT 'anon_sessions', * FROM security_test.non_truncate_acl('public.anon_sessions')
   ) a) AS intake_non_truncate_acl,
  (SELECT has_table_privilege('service_role', 'public.waitlist', 'TRUNCATE')
      AND has_table_privilege('service_role', 'public.anon_sessions', 'TRUNCATE')) AS service_truncate,
  (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.policyname)
   FROM pg_policies p WHERE p.tablename = 'profiles'
     AND p.policyname IN ('profiles_insert_own', 'profiles_select_own', 'profiles_update_own')) AS profiles_owner_policies,
  (SELECT to_jsonb(relacl::text[]) FROM pg_class WHERE oid = 'public.profiles'::regclass) AS profiles_acl,
  (SELECT coalesce(jsonb_agg(jsonb_build_array(tgname, tgenabled, pg_get_triggerdef(oid)) ORDER BY tgname), '[]')
   FROM pg_trigger WHERE tgrelid = 'public.profiles'::regclass AND NOT tgisinternal) AS profiles_triggers,
  (SELECT coalesce(jsonb_agg(jsonb_build_array(conname, pg_get_constraintdef(oid)) ORDER BY conname), '[]')
   FROM pg_constraint WHERE conrelid = 'public.profiles'::regclass) AS profiles_constraints,
  (SELECT jsonb_agg(jsonb_build_array(a.attname, a.attgenerated, pg_get_expr(d.adbin, d.adrelid)) ORDER BY a.attnum)
   FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
   WHERE a.attrelid = 'public.profiles'::regclass AND a.attnum > 0 AND NOT a.attisdropped) AS profiles_columns,
  (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM public.profiles p) AS profiles_rows;
