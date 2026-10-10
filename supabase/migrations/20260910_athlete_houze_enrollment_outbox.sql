-- Additive Athlete Houze production enrollment + durable delivery outbox.
-- Does not modify opportunities payload, drop tables, or change canary metadata checks.
-- RLS: authenticated users may only read/write their own rows.

CREATE TABLE IF NOT EXISTS public.athlete_houze_enrollments (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  houze_athlete_id uuid NOT NULL,
  consent_scope text NOT NULL DEFAULT 'restricted',
  status text NOT NULL DEFAULT 'linked',
  connected_at timestamptz NOT NULL DEFAULT now(),
  disconnected_at timestamptz NULL,
  last_sync_at timestamptz NULL,
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT athlete_houze_enrollments_status_check
    CHECK (status IN ('linked', 'disconnected')),
  CONSTRAINT athlete_houze_enrollments_scope_check
    CHECK (consent_scope IN ('restricted'))
);

COMMENT ON TABLE public.athlete_houze_enrollments IS
  'Consented Athlete Houze production enrollment for the signed-in owned Ledger account. Separate from synthetic canary app_metadata.';

CREATE INDEX IF NOT EXISTS idx_athlete_houze_enrollments_status
  ON public.athlete_houze_enrollments (status);

DROP TRIGGER IF EXISTS trg_athlete_houze_enrollments_updated_at ON public.athlete_houze_enrollments;
CREATE TRIGGER trg_athlete_houze_enrollments_updated_at
  BEFORE UPDATE ON public.athlete_houze_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_workflow_updated_at();

ALTER TABLE public.athlete_houze_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "athlete_houze_enrollments_select_own" ON public.athlete_houze_enrollments;
CREATE POLICY "athlete_houze_enrollments_select_own"
  ON public.athlete_houze_enrollments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "athlete_houze_enrollments_insert_own" ON public.athlete_houze_enrollments;
CREATE POLICY "athlete_houze_enrollments_insert_own"
  ON public.athlete_houze_enrollments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "athlete_houze_enrollments_update_own" ON public.athlete_houze_enrollments;
CREATE POLICY "athlete_houze_enrollments_update_own"
  ON public.athlete_houze_enrollments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.athlete_houze_enrollments TO authenticated;

CREATE TABLE IF NOT EXISTS public.athlete_houze_delivery_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_record_id text NOT NULL,
  source_revision text NOT NULL,
  event_identity text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz NULL,
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT athlete_houze_delivery_outbox_event_identity_uidx UNIQUE (event_identity),
  CONSTRAINT athlete_houze_delivery_outbox_payload_is_object
    CHECK (jsonb_typeof(payload) = 'object')
);

COMMENT ON TABLE public.athlete_houze_delivery_outbox IS
  'Durable Athlete Houze delivery queue. event_identity is source record + revision so retries dedupe while A→B→A stays distinct.';
COMMENT ON COLUMN public.athlete_houze_delivery_outbox.payload IS
  'Privacy-minimized nil.opportunity.updated body. Must not include deal amounts, contracts, or business contacts.';

CREATE INDEX IF NOT EXISTS idx_athlete_houze_outbox_user_pending
  ON public.athlete_houze_delivery_outbox (user_id, next_attempt_at)
  WHERE delivered_at IS NULL;

DROP TRIGGER IF EXISTS trg_athlete_houze_outbox_updated_at ON public.athlete_houze_delivery_outbox;
CREATE TRIGGER trg_athlete_houze_outbox_updated_at
  BEFORE UPDATE ON public.athlete_houze_delivery_outbox
  FOR EACH ROW
  EXECUTE FUNCTION public.set_workflow_updated_at();

ALTER TABLE public.athlete_houze_delivery_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "athlete_houze_outbox_select_own" ON public.athlete_houze_delivery_outbox;
CREATE POLICY "athlete_houze_outbox_select_own"
  ON public.athlete_houze_delivery_outbox
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "athlete_houze_outbox_insert_own" ON public.athlete_houze_delivery_outbox;
CREATE POLICY "athlete_houze_outbox_insert_own"
  ON public.athlete_houze_delivery_outbox
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "athlete_houze_outbox_update_own" ON public.athlete_houze_delivery_outbox;
CREATE POLICY "athlete_houze_outbox_update_own"
  ON public.athlete_houze_delivery_outbox
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.athlete_houze_delivery_outbox TO authenticated;
