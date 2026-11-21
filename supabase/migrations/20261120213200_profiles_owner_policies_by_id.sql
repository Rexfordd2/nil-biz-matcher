-- profiles.id is the auth.users key. Where profiles.user_id is an ordinary
-- nullable column (not generated from id), the user_id-keyed policies let a
-- signed-in user insert a row for another account's id, and hide rows created by
-- handle_new_user() (user_id NULL) from their owner. Key ownership on id.
-- Rows, grants, and handle_new_user() are unchanged.
DO $$
DECLARE
  expected constant jsonb := jsonb_build_object(
    'profiles_select_own', jsonb_build_array('SELECT', '(auth.uid() = user_id)', NULL),
    'profiles_upsert_own', jsonb_build_array('INSERT', NULL, '(auth.uid() = user_id)'),
    'profiles_update_own', jsonb_build_array('UPDATE', '(auth.uid() = user_id)', '(auth.uid() = user_id)'),
    'profiles_delete_own', jsonb_build_array('DELETE', '(auth.uid() = user_id)', NULL)
  );
  matched int;
BEGIN
  SELECT count(*) INTO matched
  FROM pg_policies p
  WHERE p.schemaname = 'public' AND p.tablename = 'profiles'
    AND expected ? p.policyname
    AND p.permissive = 'PERMISSIVE'
    AND p.roles::text = '{public}'
    AND jsonb_build_array(p.cmd, p.qual, p.with_check) = expected -> p.policyname;
  IF matched <> 4
     OR (SELECT count(*) FROM pg_policies
         WHERE schemaname = 'public' AND tablename = 'profiles') <> 4
     OR NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.profiles'::regclass AND contype = 'f'
         AND confrelid = 'auth.users'::regclass
         AND conkey = ARRAY[(SELECT attnum FROM pg_attribute
                             WHERE attrelid = 'public.profiles'::regclass
                               AND attname = 'id')]::int2[]
     ) THEN
    RAISE EXCEPTION 'profiles policy preflight changed; inspect before applying';
  END IF;
END $$;

DROP POLICY "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY "profiles_upsert_own" ON public.profiles;
CREATE POLICY "profiles_upsert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id AND coalesce(user_id, id) = id);

DROP POLICY "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND coalesce(user_id, id) = id);

DROP POLICY "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);
