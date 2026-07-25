-- ============================================================================
-- Migration: NIL Roster workflow cloud persistence (opportunities, deals, events)
-- ============================================================================
-- Additive only. Does not modify existing tables or migrate remote data.
-- Payload may contain financial, contractual, location, or compliance-adjacent
-- information and must remain private (RLS: auth.uid() = user_id only).
--
-- Created: 2026-07-23
-- Purpose: Safe cloud-persistence foundation for PR-4A (no UI cutover)
-- ============================================================================

-- Workflow-specific updated_at helper.
-- Do NOT replace public.set_updated_at(): production shares it with profiles and
-- athlete_profiles triggers. A global CREATE OR REPLACE would be unnecessary risk.
CREATE OR REPLACE FUNCTION public.set_workflow_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- public.opportunities
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  athlete_id text NULL,
  title text NULL,
  status text NULL,
  category text NULL,
  target_brand_name text NULL,
  expected_start_date text NULL,
  expected_end_date text NULL,
  linked_deal_client_id text NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'nil_roster_app',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunities_user_client_unique UNIQUE (user_id, client_id),
  CONSTRAINT opportunities_payload_is_object CHECK (jsonb_typeof(payload) = 'object')
);

COMMENT ON TABLE public.opportunities IS
  'NIL Roster opportunity records. payload may contain notes and brand targeting details; private to user_id via RLS.';
COMMENT ON COLUMN public.opportunities.payload IS
  'Lossless JSON object of the client Opportunity record. May include financial, contractual, or planning notes; must remain private.';
COMMENT ON COLUMN public.opportunities.user_id IS
  'Authenticated account owner. Never trust user identity from payload.';

CREATE INDEX IF NOT EXISTS idx_opportunities_user_id ON public.opportunities (user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_user_status ON public.opportunities (user_id, status);
CREATE INDEX IF NOT EXISTS idx_opportunities_user_expected_start ON public.opportunities (user_id, expected_start_date);

DROP TRIGGER IF EXISTS trg_opportunities_updated_at ON public.opportunities;
CREATE TRIGGER trg_opportunities_updated_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_workflow_updated_at();

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "opportunities_select_own" ON public.opportunities;
CREATE POLICY "opportunities_select_own"
  ON public.opportunities
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "opportunities_insert_own" ON public.opportunities;
CREATE POLICY "opportunities_insert_own"
  ON public.opportunities
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "opportunities_update_own" ON public.opportunities;
CREATE POLICY "opportunities_update_own"
  ON public.opportunities
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "opportunities_delete_own" ON public.opportunities;
CREATE POLICY "opportunities_delete_own"
  ON public.opportunities
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- public.deals
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  athlete_id text NULL,
  title text NULL,
  status text NULL,
  brand_name text NULL,
  deal_type text NULL,
  value_estimate numeric NULL,
  currency text NULL,
  start_date text NULL,
  end_date text NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'nil_roster_app',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deals_user_client_unique UNIQUE (user_id, client_id),
  CONSTRAINT deals_payload_is_object CHECK (jsonb_typeof(payload) = 'object')
);

COMMENT ON TABLE public.deals IS
  'NIL Roster deal log entries. payload may contain payments, compliance, documents, and contacts; private to user_id via RLS.';
COMMENT ON COLUMN public.deals.payload IS
  'Lossless JSON object of the client DealLogEntry record. May include financial, contractual, compliance, contact, or document data; must remain private.';
COMMENT ON COLUMN public.deals.user_id IS
  'Authenticated account owner. Never trust user identity from payload.';

CREATE INDEX IF NOT EXISTS idx_deals_user_id ON public.deals (user_id);
CREATE INDEX IF NOT EXISTS idx_deals_user_status ON public.deals (user_id, status);
CREATE INDEX IF NOT EXISTS idx_deals_user_start_date ON public.deals (user_id, start_date);

DROP TRIGGER IF EXISTS trg_deals_updated_at ON public.deals;
CREATE TRIGGER trg_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_workflow_updated_at();

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deals_select_own" ON public.deals;
CREATE POLICY "deals_select_own"
  ON public.deals
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "deals_insert_own" ON public.deals;
CREATE POLICY "deals_insert_own"
  ON public.deals
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "deals_update_own" ON public.deals;
CREATE POLICY "deals_update_own"
  ON public.deals
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "deals_delete_own" ON public.deals;
CREATE POLICY "deals_delete_own"
  ON public.deals
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- public.events
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  athlete_id text NULL,
  name text NULL,
  event_type text NULL,
  event_date text NULL,
  location text NULL,
  host_organization text NULL,
  linked_deal_client_id text NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'nil_roster_app',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT events_user_client_unique UNIQUE (user_id, client_id),
  CONSTRAINT events_payload_is_object CHECK (jsonb_typeof(payload) = 'object')
);

COMMENT ON TABLE public.events IS
  'NIL Roster event plans. payload may contain location, sponsors, waivers, and notes; private to user_id via RLS.';
COMMENT ON COLUMN public.events.payload IS
  'Lossless JSON object of the client EventPlan record. May include location, attendance, sponsor, or compliance-adjacent URLs; must remain private.';
COMMENT ON COLUMN public.events.user_id IS
  'Authenticated account owner. Never trust user identity from payload.';

CREATE INDEX IF NOT EXISTS idx_events_user_id ON public.events (user_id);
CREATE INDEX IF NOT EXISTS idx_events_user_event_type ON public.events (user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_events_user_event_date ON public.events (user_id, event_date);

DROP TRIGGER IF EXISTS trg_events_updated_at ON public.events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_workflow_updated_at();

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_select_own" ON public.events;
CREATE POLICY "events_select_own"
  ON public.events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "events_insert_own" ON public.events;
CREATE POLICY "events_insert_own"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "events_update_own" ON public.events;
CREATE POLICY "events_update_own"
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "events_delete_own" ON public.events;
CREATE POLICY "events_delete_own"
  ON public.events
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
