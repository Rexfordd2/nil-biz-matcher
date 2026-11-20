-- Runs inside the runner's transaction before the migration. Keeps history
-- single-entry and monotonic. Reads release.version set by the runner.
DO $$
DECLARE
  target text := current_setting('release.version');
  later text;
BEGIN
  IF to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
    RAISE EXCEPTION 'ledger: supabase_migrations.schema_migrations not found';
  END IF;
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = target) THEN
    RAISE EXCEPTION 'ledger: % is already recorded; not re-applying', target;
  END IF;
  IF (SELECT count(*) FROM supabase_migrations.schema_migrations
      WHERE version = '20261115064747') <> 1 THEN
    RAISE EXCEPTION 'ledger: private-intake migration 20261115064747 is not recorded exactly once';
  END IF;
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations
             WHERE version IN ('20261113214126', '20261120213200')) THEN
    RAISE EXCEPTION 'ledger: a withdrawn version is recorded; inspect history before continuing';
  END IF;
  SELECT max(version) INTO later FROM supabase_migrations.schema_migrations
  WHERE rpad(version, 14, '0') > rpad(target, 14, '0');
  IF later IS NOT NULL THEN
    RAISE EXCEPTION 'ledger: later version % already recorded; % would be out of order', later, target;
  END IF;
END $$;
