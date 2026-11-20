-- Postconditions for 20261120233000, in the same transaction. The migration
-- checks rows, triggers, constraints, columns and grants itself; this repeats
-- the externally visible end state.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'profiles'
               AND policyname = 'profiles_anon_insert') THEN
    RAISE EXCEPTION 'post: profiles_anon_insert still present';
  END IF;
  IF (SELECT array_agg(policyname || ':' || cmd ORDER BY policyname)
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles')
     IS DISTINCT FROM ARRAY['profiles_insert_own:INSERT', 'profiles_select_own:SELECT',
                            'profiles_update_own:UPDATE'] THEN
    RAISE EXCEPTION 'post: profiles policies are not exactly the three owner policies';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'profiles'
               AND (roles && ARRAY['anon', 'public']::name[] OR cmd IN ('DELETE', 'ALL'))) THEN
    RAISE EXCEPTION 'post: a profiles policy covers anon/PUBLIC or DELETE';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles r
             WHERE pg_has_role('anon', r.oid, 'MEMBER')
               AND has_any_column_privilege(r.oid, 'public.profiles', 'INSERT')) THEN
    RAISE EXCEPTION 'post: anon can INSERT into profiles';
  END IF;
  IF (SELECT attgenerated FROM pg_attribute
      WHERE attrelid = 'public.profiles'::regclass AND attname = 'user_id') <> 's' THEN
    RAISE EXCEPTION 'post: profiles.user_id is no longer a stored generated column';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                 WHERE tgrelid = 'auth.users'::regclass
                   AND tgfoid = 'public.handle_new_user()'::regprocedure
                   AND tgenabled <> 'D') THEN
    RAISE EXCEPTION 'post: sign-up trigger missing or disabled';
  END IF;
END $$;
