-- Production-shaped disposable fixture (synthetic only).
-- Models verified remote characteristics BEFORE reconciliation:
--   - waitlist, richer profiles, athlete_profiles(text user_id), saved_businesses
--   - businesses + user_businesses
--   - shared set_updated_at with dependents
--   - missing recruiting/bootstrap/anon/search/workflow tables
--   - no supabase_migrations ledger rows (fixture does not create the ledger)
-- Do NOT copy production row content.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  anon_id text,
  source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_email_lower_unique
  ON public.waitlist (lower(email));
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON public.waitlist (created_at);
CREATE INDEX IF NOT EXISTS idx_waitlist_anon_id
  ON public.waitlist (anon_id) WHERE anon_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  role text,
  guardian_required boolean DEFAULT false,
  terms_version text,
  terms_accepted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  phone text,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  display_name text,
  user_id uuid
);

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Live production shape: text PK (not uuid)
CREATE TABLE IF NOT EXISTS public.athlete_profiles (
  user_id text PRIMARY KEY,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_athlete_profiles_updated_at ON public.athlete_profiles;
CREATE TRIGGER trg_athlete_profiles_updated_at
  BEFORE UPDATE ON public.athlete_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.saved_businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id text NOT NULL,
  name text NOT NULL,
  address text,
  lat double precision,
  lng double precision,
  phone text,
  website text,
  rating numeric,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, place_id)
);

CREATE TABLE IF NOT EXISTS public.businesses (
  place_id text PRIMARY KEY,
  name text NOT NULL,
  address text,
  lat double precision,
  lng double precision,
  phone text,
  website text,
  rating numeric,
  types text[] DEFAULT '{}'::text[],
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id text NOT NULL REFERENCES public.businesses(place_id) ON DELETE CASCADE,
  status text,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, place_id)
);

-- Synthetic records only (no production content)
INSERT INTO auth.users (id)
VALUES ('11111111-1111-4111-8111-111111111111')
ON CONFLICT DO NOTHING;

INSERT INTO public.waitlist (email, source)
VALUES ('fixture-waitlist@example.invalid', 'fixture');

INSERT INTO public.athlete_profiles (user_id, profile)
VALUES ('11111111-1111-4111-8111-111111111111', '{"fixture":true}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO public.businesses (place_id, name)
VALUES ('fixture-place-1', 'Fixture Business')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_businesses (user_id, place_id, status)
VALUES ('11111111-1111-4111-8111-111111111111', 'fixture-place-1', 'saved')
ON CONFLICT DO NOTHING;

INSERT INTO public.saved_businesses (user_id, place_id, name)
VALUES ('11111111-1111-4111-8111-111111111111', 'fixture-place-1', 'Fixture Business')
ON CONFLICT DO NOTHING;
