-- Probe helpers. Every probe runs as the given role inside a subtransaction
-- that is always rolled back, so probes never leave rows or grants behind.
CREATE SCHEMA IF NOT EXISTS security_test;

CREATE OR REPLACE FUNCTION security_test.attempt(
  probe_role text,
  probe_sub uuid,
  probe_sql text
) RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    EXECUTE format('SET LOCAL ROLE %I', probe_role);
    PERFORM set_config(
      'request.jwt.claims',
      CASE WHEN probe_sub IS NULL
        THEN json_build_object('role', probe_role)::text
        ELSE json_build_object('role', probe_role, 'sub', probe_sub)::text
      END,
      true
    );
    EXECUTE probe_sql;
    RAISE EXCEPTION USING ERRCODE = 'TPROB', MESSAGE = 'probe completed';
  EXCEPTION
    WHEN SQLSTATE 'TPROB' THEN
      RETURN 'ok';
    WHEN OTHERS THEN
      RETURN SQLSTATE || ' ' || SQLERRM;
  END;
END;
$$;

CREATE TABLE IF NOT EXISTS security_test.results (
  phase text NOT NULL,
  label text NOT NULL,
  expected text NOT NULL,
  actual text NOT NULL,
  passed boolean NOT NULL
);

-- expected is 'ok' or a SQLSTATE prefix such as '42501'.
CREATE OR REPLACE FUNCTION security_test.expect(
  phase text,
  label text,
  expected text,
  probe_role text,
  probe_sub uuid,
  probe_sql text
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  actual text := security_test.attempt(probe_role, probe_sub, probe_sql);
BEGIN
  INSERT INTO security_test.results
  VALUES (phase, label, expected, actual,
          actual = expected OR actual LIKE expected || ' %');
END;
$$;

CREATE OR REPLACE FUNCTION security_test.check(
  phase text,
  label text,
  condition boolean
) RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO security_test.results
  VALUES (phase, label, 'true', coalesce(condition::text, 'null'), coalesce(condition, false));
$$;

-- Table privileges per grantee, without TRUNCATE.
CREATE OR REPLACE FUNCTION security_test.non_truncate_acl(tbl regclass)
RETURNS TABLE (grantee text, privilege text, grantable boolean)
LANGUAGE sql
AS $$
  SELECT CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END,
         a.privilege_type, a.is_grantable
  FROM pg_class c, aclexplode(c.relacl) a
  WHERE c.oid = tbl AND a.privilege_type <> 'TRUNCATE';
$$;
