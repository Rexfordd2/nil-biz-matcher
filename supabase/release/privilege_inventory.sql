-- Least-privilege inventory for every API-exposed relation in schema public.
-- Metadata only: reads catalogs, never table contents. Runs in a READ ONLY
-- transaction that ends in ROLLBACK. Changes nothing.
--
-- Reachability model:
--   db_reachable   the role (directly, via PUBLIC, or via any role it can
--                  SET ROLE to) holds the privilege; usable from any SQL path
--                  running as that role (SECURITY INVOKER functions, direct
--                  connections as the role, future RPCs).
--   api_reachable  PostgREST/pg_graphql can exercise it: only SELECT, INSERT,
--                  UPDATE, DELETE, and only when RLS is off or a permissive
--                  policy for that command covers the role (constant-false
--                  deny policies excluded). Rows are still limited by the
--                  policy predicate. TRUNCATE, REFERENCES and TRIGGER have
--                  no API verb.
BEGIN READ ONLY;

WITH api(role) AS (VALUES ('anon'), ('authenticated')),
rel AS (
  SELECT c.oid, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity,
         pg_get_userbyid(c.relowner) AS owner
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
),
priv AS (
  SELECT rel.oid, api.role, p.priv,
         bool_or(has_table_privilege(r.oid, rel.oid, p.priv)) AS db_reachable,
         bool_or(has_any_column_privilege(r.oid, rel.oid, p.priv))
           FILTER (WHERE p.priv IN ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')) AS column_reachable
  FROM rel
  CROSS JOIN api
  JOIN pg_roles r ON pg_has_role(api.role, r.oid, 'MEMBER')
  CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
                     ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) AS p(priv)
  GROUP BY rel.oid, api.role, p.priv
),
pol AS (
  SELECT rel.oid, api.role, cmd.c AS priv,
         count(*) FILTER (WHERE p.permissive = 'PERMISSIVE'
                            AND coalesce(p.qual, 'true') <> 'false'
                            AND coalesce(p.with_check, 'true') <> 'false') AS permissive_policies,
         string_agg(p.policyname || ' [' || coalesce(p.qual, '-') || ' | ' || coalesce(p.with_check, '-') || ']',
                    '; ' ORDER BY p.policyname) AS policies
  FROM rel
  CROSS JOIN api
  CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS cmd(c)
  LEFT JOIN pg_policies p
    ON p.schemaname = 'public' AND p.tablename = rel.relname
   AND p.cmd IN (cmd.c, 'ALL')
   AND p.roles && ARRAY[api.role, 'public']::name[]
  GROUP BY rel.oid, api.role, cmd.c
)
SELECT rel.relname AS relation,
       rel.relkind,
       rel.owner,
       rel.relrowsecurity AS rls,
       rel.relforcerowsecurity AS rls_forced,
       priv.role,
       string_agg(priv.priv, ',' ORDER BY priv.priv) FILTER (WHERE priv.db_reachable) AS db_reachable,
       string_agg(priv.priv, ',' ORDER BY priv.priv)
         FILTER (WHERE NOT priv.db_reachable AND priv.column_reachable) AS column_only,
       string_agg(priv.priv, ',' ORDER BY priv.priv)
         FILTER (WHERE (priv.db_reachable OR coalesce(priv.column_reachable, false))
                   AND priv.priv IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
                   AND (NOT rel.relrowsecurity OR rel.relkind IN ('v', 'm', 'f')
                        OR coalesce(pol.permissive_policies, 0) > 0)) AS api_reachable,
       string_agg(priv.priv, ',' ORDER BY priv.priv)
         FILTER (WHERE priv.db_reachable AND priv.priv IN ('TRUNCATE', 'TRIGGER', 'REFERENCES')) AS db_only_destructive,
       string_agg(priv.priv, ',' ORDER BY priv.priv)
         FILTER (WHERE priv.db_reachable AND priv.priv IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
                   AND rel.relrowsecurity AND rel.relkind IN ('r', 'p')
                   AND coalesce(pol.permissive_policies, 0) = 0) AS granted_but_rls_blocked,
       string_agg(priv.priv || ': ' || pol.policies, ' || ' ORDER BY priv.priv)
         FILTER (WHERE pol.policies IS NOT NULL) AS covering_policies
FROM rel
JOIN priv ON priv.oid = rel.oid
LEFT JOIN pol ON pol.oid = rel.oid AND pol.role = priv.role AND pol.priv = priv.priv
GROUP BY rel.relname, rel.relkind, rel.owner, rel.relrowsecurity, rel.relforcerowsecurity, priv.role
ORDER BY rel.relname, priv.role;

-- Source of the broad grants: default privileges for future objects in public.
SELECT pg_get_userbyid(d.defaclrole) AS creating_role,
       CASE d.defaclobjtype WHEN 'r' THEN 'tables' WHEN 'S' THEN 'sequences'
            WHEN 'f' THEN 'functions' ELSE d.defaclobjtype::text END AS object_type,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END AS grantee,
       string_agg(a.privilege_type, ',' ORDER BY a.privilege_type) AS privileges
FROM pg_default_acl d
JOIN pg_namespace n ON n.oid = d.defaclnamespace AND n.nspname = 'public'
CROSS JOIN LATERAL aclexplode(d.defaclacl) a
WHERE a.grantee = 0 OR a.grantee::regrole::text IN ('anon', 'authenticated')
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;

-- SECURITY DEFINER functions in public that a client role can EXECUTE.
SELECT p.oid::regprocedure AS function, pg_get_userbyid(p.proowner) AS owner,
       p.prorettype::regtype AS returns, api.role,
       bool_or(has_function_privilege(r.oid, p.oid, 'EXECUTE')) AS executable
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
CROSS JOIN (VALUES ('anon'), ('authenticated')) AS api(role)
JOIN pg_roles r ON pg_has_role(api.role, r.oid, 'MEMBER')
WHERE p.prosecdef
GROUP BY 1, 2, 3, 4
ORDER BY 1, 4;

ROLLBACK;
