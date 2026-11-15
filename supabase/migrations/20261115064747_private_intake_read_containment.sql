-- Private intake contacts and anonymous-session identifiers are operator data.
-- Keep existing INSERT policies and all stored rows. Service-role/owner access
-- remains available; ordinary signed-in users may not browse these tables.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'waitlist'
      AND policyname = 'Allow authenticated waitlist reads'
      AND NOT (cmd = 'SELECT' AND qual = 'true'
        AND roles::text = '{authenticated}')
  ) OR EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'anon_sessions'
      AND policyname = 'Allow authenticated anon_sessions reads'
      AND NOT (cmd = 'SELECT' AND qual = 'true'
        AND roles::text = '{authenticated}')
  ) THEN
    RAISE EXCEPTION 'Private intake policy preflight changed; inspect before applying';
  END IF;
END $$;
DROP POLICY IF EXISTS "Allow authenticated waitlist reads" ON public.waitlist;
DROP POLICY IF EXISTS "Allow authenticated anon_sessions reads" ON public.anon_sessions;
