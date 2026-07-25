-- ============================================================================
-- Migration: Reconcile NIL Roster production schema gaps (forward-only)
-- ============================================================================
-- Additive only. Proven against live project duuvyyvfqbzozuhzlbek catalog audit.
-- Does NOT:
--   - convert athlete_profiles.user_id (preserve live text PK)
--   - DROP / TRUNCATE / DELETE data
--   - replace public.set_updated_at() (shared by profiles + athlete_profiles)
--   - create workflow tables (owned by 20260723)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Missing recruiting / profile bootstrap tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.athlete_profile (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bio text,
  school text,
  grad_year int,
  positions text[] DEFAULT '{}',
  height_inches int,
  weight_lbs int,
  gpa numeric(3,2),
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  highlight_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_step text,
  percent_complete int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sport text,
  level text,
  org_type text,
  country text,
  region text,
  city text,
  website_url text,
  general_email text,
  general_phone text,
  notes text,
  source_url text,
  visibility text NOT NULL DEFAULT 'private',
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'orgs'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orgs' AND column_name = 'user_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orgs' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE public.orgs
      ADD COLUMN user_id uuid GENERATED ALWAYS AS (owner_id) STORED;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.org_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text,
  name text,
  email text,
  phone text,
  contact_url text,
  notes text,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_contacts
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.org_contacts
  ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.org_contacts
  ADD COLUMN IF NOT EXISTS source_url text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'org_contacts' AND column_name = 'user_id'
  ) THEN
    BEGIN
      ALTER TABLE public.org_contacts ALTER COLUMN user_id SET DEFAULT auth.uid();
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'To Contact',
  tags text[] NOT NULL DEFAULT '{}',
  notes text,
  next_followup_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id)
);

CREATE TABLE IF NOT EXISTS public.recruiting_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'not_contacted',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Missing anon / user_data / search_cache
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.anon_sessions (
  anon_id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anon_sessions_last_seen ON public.anon_sessions(last_seen);

-- anon_id nullable so authenticated inserts (user_id only) match app behavior
CREATE TABLE IF NOT EXISTS public.user_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_id text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  data_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_data
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- If a prior empty table created anon_id as NOT NULL, relax it when safe (no rows violate).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_data'
      AND column_name = 'anon_id' AND is_nullable = 'NO'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_data WHERE anon_id IS NULL AND user_id IS NULL
    ) THEN
      ALTER TABLE public.user_data ALTER COLUMN anon_id DROP NOT NULL;
    END IF;
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_data_anon_id ON public.user_data(anon_id);
CREATE INDEX IF NOT EXISTS idx_user_data_data_type ON public.user_data(data_type);
CREATE INDEX IF NOT EXISTS idx_user_data_created_at ON public.user_data(created_at);
CREATE INDEX IF NOT EXISTS idx_user_data_anon_id_data_type ON public.user_data(anon_id, data_type);
CREATE INDEX IF NOT EXISTS user_data_user_id_idx ON public.user_data(user_id);
CREATE INDEX IF NOT EXISTS user_data_user_id_data_type_idx
  ON public.user_data(user_id, data_type) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.search_cache (
  key text PRIMARY KEY,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_cache_created_at ON public.search_cache(created_at);

COMMENT ON TABLE public.search_cache IS
  'Persistent cache for Google Places API search results. Server-side only.';

-- ---------------------------------------------------------------------------
-- Helper: anon session touch (security definer; limited execute grant)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_anon_session_last_seen(anon_id_param text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.anon_sessions
  SET last_seen = now()
  WHERE anon_sessions.anon_id = anon_id_param;

  IF NOT FOUND THEN
    INSERT INTO public.anon_sessions (anon_id, created_at, last_seen)
    VALUES (anon_id_param, now(), now())
    ON CONFLICT (anon_id) DO UPDATE
    SET last_seen = now();
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_anon_session_last_seen(text) TO anon;

-- ---------------------------------------------------------------------------
-- Workflow-specific updated_at (does not replace shared set_updated_at)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_workflow_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS enable
-- ---------------------------------------------------------------------------

ALTER TABLE public.athlete_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiting_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anon_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_cache ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Policies: athlete_profile
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "athlete_select_own" ON public.athlete_profile;
CREATE POLICY "athlete_select_own"
  ON public.athlete_profile FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "athlete_insert_own" ON public.athlete_profile;
CREATE POLICY "athlete_insert_own"
  ON public.athlete_profile FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "athlete_update_own" ON public.athlete_profile;
CREATE POLICY "athlete_update_own"
  ON public.athlete_profile FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "athlete_delete_own" ON public.athlete_profile;
CREATE POLICY "athlete_delete_own"
  ON public.athlete_profile FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Policies: onboarding_progress
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "onboarding_select_own" ON public.onboarding_progress;
CREATE POLICY "onboarding_select_own"
  ON public.onboarding_progress FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "onboarding_insert_own" ON public.onboarding_progress;
CREATE POLICY "onboarding_insert_own"
  ON public.onboarding_progress FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "onboarding_update_own" ON public.onboarding_progress;
CREATE POLICY "onboarding_update_own"
  ON public.onboarding_progress FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "onboarding_delete_own" ON public.onboarding_progress;
CREATE POLICY "onboarding_delete_own"
  ON public.onboarding_progress FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Policies: orgs (owner_id)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "orgs_select_own" ON public.orgs;
CREATE POLICY "orgs_select_own"
  ON public.orgs FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "orgs_insert_own" ON public.orgs;
CREATE POLICY "orgs_insert_own"
  ON public.orgs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "orgs_update_own" ON public.orgs;
CREATE POLICY "orgs_update_own"
  ON public.orgs FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "orgs_delete_own" ON public.orgs;
CREATE POLICY "orgs_delete_own"
  ON public.orgs FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- Policies: org_contacts
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "org_contacts_select_own" ON public.org_contacts;
CREATE POLICY "org_contacts_select_own"
  ON public.org_contacts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "org_contacts_insert_own" ON public.org_contacts;
CREATE POLICY "org_contacts_insert_own"
  ON public.org_contacts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "org_contacts_update_own" ON public.org_contacts;
CREATE POLICY "org_contacts_update_own"
  ON public.org_contacts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "org_contacts_delete_own" ON public.org_contacts;
CREATE POLICY "org_contacts_delete_own"
  ON public.org_contacts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Policies: user_targets
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "user_targets_select_own" ON public.user_targets;
CREATE POLICY "user_targets_select_own"
  ON public.user_targets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_targets_insert_own" ON public.user_targets;
CREATE POLICY "user_targets_insert_own"
  ON public.user_targets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_targets_update_own" ON public.user_targets;
CREATE POLICY "user_targets_update_own"
  ON public.user_targets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_targets_delete_own" ON public.user_targets;
CREATE POLICY "user_targets_delete_own"
  ON public.user_targets FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Policies: recruiting_targets
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "recruiting_targets_select_own" ON public.recruiting_targets;
CREATE POLICY "recruiting_targets_select_own"
  ON public.recruiting_targets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "recruiting_targets_insert_own" ON public.recruiting_targets;
CREATE POLICY "recruiting_targets_insert_own"
  ON public.recruiting_targets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "recruiting_targets_update_own" ON public.recruiting_targets;
CREATE POLICY "recruiting_targets_update_own"
  ON public.recruiting_targets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "recruiting_targets_delete_own" ON public.recruiting_targets;
CREATE POLICY "recruiting_targets_delete_own"
  ON public.recruiting_targets FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Policies: anon_sessions
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow anonymous anon_sessions inserts" ON public.anon_sessions;
CREATE POLICY "Allow anonymous anon_sessions inserts"
  ON public.anon_sessions FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Deny anonymous anon_sessions updates" ON public.anon_sessions;
CREATE POLICY "Deny anonymous anon_sessions updates"
  ON public.anon_sessions FOR UPDATE TO anon
  USING (false);

DROP POLICY IF EXISTS "Deny anonymous anon_sessions selects" ON public.anon_sessions;
CREATE POLICY "Deny anonymous anon_sessions selects"
  ON public.anon_sessions FOR SELECT TO anon
  USING (false);

DROP POLICY IF EXISTS "Deny anonymous anon_sessions deletes" ON public.anon_sessions;
CREATE POLICY "Deny anonymous anon_sessions deletes"
  ON public.anon_sessions FOR DELETE TO anon
  USING (false);

DROP POLICY IF EXISTS "Allow authenticated anon_sessions reads" ON public.anon_sessions;
CREATE POLICY "Allow authenticated anon_sessions reads"
  ON public.anon_sessions FOR SELECT TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- Policies: user_data
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow anonymous user_data inserts" ON public.user_data;
DROP POLICY IF EXISTS "Deny anonymous user_data selects" ON public.user_data;
DROP POLICY IF EXISTS "Deny anonymous user_data updates" ON public.user_data;
DROP POLICY IF EXISTS "Deny anonymous user_data deletes" ON public.user_data;
DROP POLICY IF EXISTS "Allow authenticated user_data reads" ON public.user_data;
DROP POLICY IF EXISTS "Users can read their own user_data" ON public.user_data;
DROP POLICY IF EXISTS "Users can insert their own user_data" ON public.user_data;
DROP POLICY IF EXISTS "Anonymous users can insert with anon_id" ON public.user_data;
DROP POLICY IF EXISTS "user_data_select_own" ON public.user_data;
DROP POLICY IF EXISTS "user_data_insert_own" ON public.user_data;
DROP POLICY IF EXISTS "user_data_update_own" ON public.user_data;
DROP POLICY IF EXISTS "user_data_delete_own" ON public.user_data;
DROP POLICY IF EXISTS "user_data_anon_insert" ON public.user_data;
DROP POLICY IF EXISTS "user_data_anon_deny_select" ON public.user_data;
DROP POLICY IF EXISTS "user_data_anon_deny_update" ON public.user_data;
DROP POLICY IF EXISTS "user_data_anon_deny_delete" ON public.user_data;

CREATE POLICY "user_data_select_own"
  ON public.user_data FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_data_insert_own"
  ON public.user_data FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_data_update_own"
  ON public.user_data FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_data_delete_own"
  ON public.user_data FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_data_anon_insert"
  ON public.user_data FOR INSERT TO anon
  WITH CHECK (user_id IS NULL AND anon_id IS NOT NULL);

CREATE POLICY "user_data_anon_deny_select"
  ON public.user_data FOR SELECT TO anon
  USING (false);

CREATE POLICY "user_data_anon_deny_update"
  ON public.user_data FOR UPDATE TO anon
  USING (false);

CREATE POLICY "user_data_anon_deny_delete"
  ON public.user_data FOR DELETE TO anon
  USING (false);

-- ---------------------------------------------------------------------------
-- Policies: search_cache (service_role only; no anon/authenticated access)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Service role can manage search cache" ON public.search_cache;
CREATE POLICY "Service role can manage search cache"
  ON public.search_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Explicit table grants (RLS still enforced)
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_profile TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orgs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_targets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recruiting_targets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_data TO authenticated;
GRANT INSERT ON public.user_data TO anon;
GRANT INSERT ON public.anon_sessions TO anon;
GRANT SELECT ON public.anon_sessions TO authenticated;
GRANT ALL ON public.search_cache TO service_role;
