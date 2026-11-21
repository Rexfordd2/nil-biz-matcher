-- Remove the dormant profiles_anon_insert policy. anon holds no INSERT
-- privilege on public.profiles, so the policy cannot admit a row today; it
-- would start admitting rows the moment such a grant appeared. Sign-up creates
-- profiles through the handle_new_user() trigger, which does not use it.
--
-- Only that policy is dropped. Rows, grants, the authenticated id-keyed
-- INSERT/SELECT/UPDATE policies, triggers, constraints and the generated
-- user_id column are checked before and after, and any difference aborts the
-- whole block. The statement is a single DO block so it is atomic even when
-- run outside an explicit transaction.
DO $$
DECLARE
  -- Exact production definition of the policy being removed, as pg_policies
  -- reports it. Any difference aborts.
  expected_permissive constant text   := 'PERMISSIVE';
  expected_roles      constant name[] := ARRAY['anon']::name[];
  expected_cmd        constant text   := 'INSERT';
  expected_qual       constant text   := NULL;
  expected_check      constant text   := 'true';

  owner_policies constant jsonb := '{
    "profiles_insert_own": "INSERT",
    "profiles_select_own": "SELECT",
    "profiles_update_own": "UPDATE"
  }';
  id_attnum int2;
  user_id_attnum int2;
  anon_path record;
  target record;
  before_rows bigint;
  before_kept jsonb;
  before_triggers jsonb;
  before_constraints jsonb;
  before_columns jsonb;
  before_acl jsonb;
  after_kept jsonb;
BEGIN
  SET LOCAL lock_timeout = '5s';
  LOCK TABLE public.profiles IN ACCESS EXCLUSIVE MODE;

  SELECT attnum INTO id_attnum FROM pg_attribute
  WHERE attrelid = 'public.profiles'::regclass AND attname = 'id' AND NOT attisdropped;
  SELECT attnum INTO user_id_attnum FROM pg_attribute
  WHERE attrelid = 'public.profiles'::regclass AND attname = 'user_id' AND NOT attisdropped;

  -- Target policy: present once, exactly as expected.
  SELECT permissive, roles, cmd, qual, with_check INTO target
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_anon_insert';
  IF NOT FOUND
     OR target.permissive IS DISTINCT FROM expected_permissive
     OR target.roles IS DISTINCT FROM expected_roles
     OR target.cmd IS DISTINCT FROM expected_cmd
     OR target.qual IS DISTINCT FROM expected_qual
     OR target.with_check IS DISTINCT FROM expected_check THEN
    RAISE EXCEPTION 'profiles_anon_insert drifted from the reviewed definition: %',
      coalesce(to_jsonb(target)::text, 'absent');
  END IF;

  -- Exactly the four audited policies, and the three kept ones are the
  -- authenticated owner policies keyed on id, never user_id.
  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'profiles') <> 4 THEN
    RAISE EXCEPTION 'profiles has policies other than the four audited ones';
  END IF;
  IF (SELECT count(*)
      FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = 'profiles'
        AND owner_policies ->> p.policyname = p.cmd
        AND p.permissive = 'PERMISSIVE'
        AND p.roles = ARRAY['authenticated']::name[]) <> 3 THEN
    RAISE EXCEPTION 'authenticated owner policies on profiles drifted';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_policy pol
    WHERE pol.polrelid = 'public.profiles'::regclass
      AND owner_policies ? pol.polname
      AND (
        NOT EXISTS (SELECT 1 FROM pg_depend d
                    WHERE d.classid = 'pg_policy'::regclass AND d.objid = pol.oid
                      AND d.refobjid = 'public.profiles'::regclass AND d.refobjsubid = id_attnum)
        OR EXISTS (SELECT 1 FROM pg_depend d
                   WHERE d.classid = 'pg_policy'::regclass AND d.objid = pol.oid
                     AND d.refobjid = 'public.profiles'::regclass AND d.refobjsubid = user_id_attnum)
      )
  ) THEN
    RAISE EXCEPTION 'an authenticated owner policy on profiles is not keyed on id alone';
  END IF;

  -- user_id is a stored generated column; RLS is enabled.
  IF user_id_attnum IS NULL
     OR (SELECT attgenerated FROM pg_attribute
         WHERE attrelid = 'public.profiles'::regclass AND attnum = user_id_attnum) <> 's' THEN
    RAISE EXCEPTION 'profiles.user_id is not a stored generated column';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.profiles'::regclass) THEN
    RAISE EXCEPTION 'row level security is not enabled on profiles';
  END IF;

  -- Effective anon INSERT (table or column level, own, PUBLIC or through any
  -- role anon can reach) must be absent.
  FOR anon_path IN
    SELECT r.rolname FROM pg_roles r
    WHERE pg_has_role('anon', r.oid, 'MEMBER')
      AND has_any_column_privilege(r.oid, 'public.profiles', 'INSERT')
  LOOP
    RAISE EXCEPTION 'anon can INSERT into profiles via %; the policy is not dormant', anon_path.rolname;
  END LOOP;

  SELECT count(*) INTO before_rows FROM public.profiles;
  SELECT jsonb_agg(to_jsonb(p) ORDER BY p.policyname) INTO before_kept
  FROM pg_policies p
  WHERE p.schemaname = 'public' AND p.tablename = 'profiles' AND owner_policies ? p.policyname;
  SELECT coalesce(jsonb_agg(jsonb_build_array(tgname, tgenabled, pg_get_triggerdef(oid)) ORDER BY tgname), '[]')
    INTO before_triggers
  FROM pg_trigger WHERE tgrelid = 'public.profiles'::regclass AND NOT tgisinternal;
  SELECT coalesce(jsonb_agg(jsonb_build_array(conname, pg_get_constraintdef(oid)) ORDER BY conname), '[]')
    INTO before_constraints
  FROM pg_constraint WHERE conrelid = 'public.profiles'::regclass;
  SELECT jsonb_agg(jsonb_build_array(a.attname, a.attgenerated, pg_get_expr(d.adbin, d.adrelid)) ORDER BY a.attnum)
    INTO before_columns
  FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE a.attrelid = 'public.profiles'::regclass AND a.attnum > 0 AND NOT a.attisdropped;
  SELECT to_jsonb(relacl::text[]) INTO before_acl FROM pg_class WHERE oid = 'public.profiles'::regclass;

  DROP POLICY profiles_anon_insert ON public.profiles;

  SELECT jsonb_agg(to_jsonb(p) ORDER BY p.policyname) INTO after_kept
  FROM pg_policies p
  WHERE p.schemaname = 'public' AND p.tablename = 'profiles';
  IF after_kept IS DISTINCT FROM before_kept THEN
    RAISE EXCEPTION 'policies other than profiles_anon_insert changed';
  END IF;
  IF (SELECT count(*) FROM public.profiles) <> before_rows THEN
    RAISE EXCEPTION 'profiles row count changed';
  END IF;
  IF (SELECT coalesce(jsonb_agg(jsonb_build_array(tgname, tgenabled, pg_get_triggerdef(oid)) ORDER BY tgname), '[]')
      FROM pg_trigger WHERE tgrelid = 'public.profiles'::regclass AND NOT tgisinternal) <> before_triggers
     OR (SELECT coalesce(jsonb_agg(jsonb_build_array(conname, pg_get_constraintdef(oid)) ORDER BY conname), '[]')
         FROM pg_constraint WHERE conrelid = 'public.profiles'::regclass) <> before_constraints
     OR (SELECT jsonb_agg(jsonb_build_array(a.attname, a.attgenerated, pg_get_expr(d.adbin, d.adrelid)) ORDER BY a.attnum)
         FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
         WHERE a.attrelid = 'public.profiles'::regclass AND a.attnum > 0 AND NOT a.attisdropped) <> before_columns
     OR (SELECT to_jsonb(relacl::text[]) FROM pg_class WHERE oid = 'public.profiles'::regclass)
        IS DISTINCT FROM before_acl THEN
    RAISE EXCEPTION 'profiles triggers, constraints, columns or grants changed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles r
             WHERE pg_has_role('anon', r.oid, 'MEMBER')
               AND has_any_column_privilege(r.oid, 'public.profiles', 'INSERT')) THEN
    RAISE EXCEPTION 'anon gained INSERT on profiles';
  END IF;
END $$;
