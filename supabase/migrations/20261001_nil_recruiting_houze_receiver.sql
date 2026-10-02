-- Inbound Athlete Houze recruiting receiver.
-- Additive. Does not edit earlier migrations or invent a schema_migrations journal.
-- HTTP activation stays development-only in the application guard; this file
-- does not grant production callers access to the commit function.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nil_recruiting_receiver_owner') THEN
    CREATE ROLE nil_recruiting_receiver_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nil_recruiting_receiver') THEN
    CREATE ROLE nil_recruiting_receiver NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.recruiting_houze_athlete_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  houze_athlete_id text NOT NULL,
  supabase_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clerk_user_id text,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recruiting_houze_athlete_links_houze_id_shape
    CHECK (houze_athlete_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
  CONSTRAINT recruiting_houze_athlete_links_clerk_shape
    CHECK (clerk_user_id IS NULL OR clerk_user_id ~ '^user_[A-Za-z0-9]{8,64}$'),
  CONSTRAINT recruiting_houze_athlete_links_clerk_not_uuid
    CHECK (
      clerk_user_id IS NULL
      OR clerk_user_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ),
  CONSTRAINT recruiting_houze_athlete_links_ids_distinct
    CHECK (
      houze_athlete_id <> supabase_user_id::text
      AND (clerk_user_id IS NULL OR clerk_user_id <> supabase_user_id::text)
      AND (clerk_user_id IS NULL OR clerk_user_id <> houze_athlete_id)
    )
);

COMMENT ON TABLE public.recruiting_houze_athlete_links IS
  'Authoritative Houze athlete to NIL account map. supabase_user_id is auth.users.id. clerk_user_id is never an account owner.';
COMMENT ON COLUMN public.recruiting_houze_athlete_links.supabase_user_id IS
  'NIL account. Never copy a Clerk id into this column.';
COMMENT ON COLUMN public.recruiting_houze_athlete_links.clerk_user_id IS
  'Optional Clerk identifier stored separately from the Supabase account id.';

CREATE UNIQUE INDEX IF NOT EXISTS recruiting_houze_athlete_links_active_houze
  ON public.recruiting_houze_athlete_links (houze_athlete_id)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.recruiting_received_entities (
  supabase_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  revision integer NOT NULL,
  content_hash text NOT NULL,
  title text NOT NULL,
  status text NOT NULL,
  note text,
  occurred_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (supabase_user_id, entity_type, entity_id),
  CONSTRAINT recruiting_received_entities_payload_object
    CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT recruiting_received_entities_revision_nonnegative
    CHECK (revision >= 0)
);

COMMENT ON TABLE public.recruiting_received_entities IS
  'Validated recruiting records applied from Athlete Houze. User-facing reads use RLS on supabase_user_id.';

CREATE TABLE IF NOT EXISTS public.recruiting_inbound_receipts (
  event_id text PRIMARY KEY,
  idempotency_key text NOT NULL,
  supabase_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  houze_athlete_id text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  revision integer NOT NULL,
  content_hash text NOT NULL,
  acknowledgement jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recruiting_inbound_receipts_idempotency_key_key UNIQUE (idempotency_key),
  CONSTRAINT recruiting_inbound_receipts_ack_object
    CHECK (jsonb_typeof(acknowledgement) = 'object')
);

COMMENT ON TABLE public.recruiting_inbound_receipts IS
  'Idempotency receipts. Lookups are by event id or idempotency key across owners. Not user-facing.';

ALTER TABLE public.recruiting_houze_athlete_links OWNER TO nil_recruiting_receiver_owner;
ALTER TABLE public.recruiting_received_entities OWNER TO nil_recruiting_receiver_owner;
ALTER TABLE public.recruiting_inbound_receipts OWNER TO nil_recruiting_receiver_owner;

ALTER TABLE public.recruiting_houze_athlete_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiting_houze_athlete_links FORCE ROW LEVEL SECURITY;
ALTER TABLE public.recruiting_received_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiting_received_entities FORCE ROW LEVEL SECURITY;
ALTER TABLE public.recruiting_inbound_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiting_inbound_receipts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recruiting_houze_athlete_links_owner_all ON public.recruiting_houze_athlete_links;
CREATE POLICY recruiting_houze_athlete_links_owner_all
  ON public.recruiting_houze_athlete_links
  FOR ALL
  TO nil_recruiting_receiver_owner
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS recruiting_received_entities_owner_all ON public.recruiting_received_entities;
CREATE POLICY recruiting_received_entities_owner_all
  ON public.recruiting_received_entities
  FOR ALL
  TO nil_recruiting_receiver_owner
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS recruiting_received_entities_select_own ON public.recruiting_received_entities;
CREATE POLICY recruiting_received_entities_select_own
  ON public.recruiting_received_entities
  FOR SELECT
  TO authenticated
  USING (auth.uid() = supabase_user_id);

DROP POLICY IF EXISTS recruiting_inbound_receipts_owner_all ON public.recruiting_inbound_receipts;
CREATE POLICY recruiting_inbound_receipts_owner_all
  ON public.recruiting_inbound_receipts
  FOR ALL
  TO nil_recruiting_receiver_owner
  USING (true)
  WITH CHECK (true);

GRANT REFERENCES, SELECT ON TABLE auth.users TO nil_recruiting_receiver_owner;

REVOKE ALL ON TABLE public.recruiting_houze_athlete_links FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.recruiting_received_entities FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.recruiting_inbound_receipts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.recruiting_received_entities TO authenticated;

CREATE OR REPLACE FUNCTION public.recruiting_receiver_content_canonical(
  p_schema_version text,
  p_houze_athlete_id text,
  p_entity_type text,
  p_entity_id text,
  p_revision integer,
  p_occurred_at text,
  p_title text,
  p_status text,
  p_note text
) RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_note IS NULL THEN concat(
      '{"entityId":', to_json(p_entity_id),
      ',"entityType":', to_json(p_entity_type),
      ',"houzeAthleteId":', to_json(p_houze_athlete_id),
      ',"occurredAt":', to_json(p_occurred_at),
      ',"payload":{"status":', to_json(p_status),
      ',"title":', to_json(p_title),
      '},"revision":', p_revision::text,
      ',"schemaVersion":', to_json(p_schema_version),
      '}'
    )
    ELSE concat(
      '{"entityId":', to_json(p_entity_id),
      ',"entityType":', to_json(p_entity_type),
      ',"houzeAthleteId":', to_json(p_houze_athlete_id),
      ',"occurredAt":', to_json(p_occurred_at),
      ',"payload":{"note":', to_json(p_note),
      ',"status":', to_json(p_status),
      ',"title":', to_json(p_title),
      '},"revision":', p_revision::text,
      ',"schemaVersion":', to_json(p_schema_version),
      '}'
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.recruiting_receiver_content_hash(
  p_schema_version text,
  p_houze_athlete_id text,
  p_entity_type text,
  p_entity_id text,
  p_revision integer,
  p_occurred_at text,
  p_title text,
  p_status text,
  p_note text
) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_canonical text;
  v_hash text;
BEGIN
  v_canonical := public.recruiting_receiver_content_canonical(
    p_schema_version,
    p_houze_athlete_id,
    p_entity_type,
    p_entity_id,
    p_revision,
    p_occurred_at,
    p_title,
    p_status,
    p_note
  );
  BEGIN
    v_hash := encode(public.digest(v_canonical, 'sha256'), 'hex');
  EXCEPTION
    WHEN undefined_function THEN
      v_hash := NULL;
  END;
  IF v_hash IS NULL THEN
    v_hash := encode(extensions.digest(v_canonical, 'sha256'), 'hex');
  END IF;
  RETURN v_hash;
END;
$$;

CREATE OR REPLACE FUNCTION public.commit_recruiting_inbound_event(
  p_event_id text,
  p_idempotency_key text,
  p_houze_athlete_id text,
  p_claimed_nil_account_id text,
  p_claimed_clerk_user_id text,
  p_entity_type text,
  p_entity_id text,
  p_revision integer,
  p_occurred_at text,
  p_title text,
  p_status text,
  p_note text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid;
  v_clerk text;
  v_claimed_nil uuid;
  v_note text;
  v_hash text;
  v_existing public.recruiting_inbound_receipts%ROWTYPE;
  v_existing_count integer;
  v_current_revision integer;
  v_current_hash text;
  v_outcome text;
  v_applied boolean;
  v_ack jsonb;
  v_payload jsonb;
  v_lock_a text;
  v_lock_b text;
  v_first text;
  v_second text;
BEGIN
  IF p_event_id IS NULL OR p_idempotency_key IS NULL OR p_houze_athlete_id IS NULL
     OR p_entity_type IS DISTINCT FROM 'recruiting_record'
     OR p_entity_id IS NULL OR p_revision IS NULL OR p_revision < 0
     OR p_occurred_at IS NULL OR p_title IS NULL OR length(btrim(p_title)) < 1 OR length(p_title) > 200
     OR p_status NOT IN ('prospect', 'contacted', 'visiting', 'committed', 'paused')
     OR p_event_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
     OR p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
     OR p_houze_athlete_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
     OR p_entity_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
     OR p_event_id = p_idempotency_key
  THEN
    RETURN jsonb_build_object('status', 'invalid_event');
  END IF;

  v_note := NULLIF(btrim(COALESCE(p_note, '')), '');
  IF v_note IS NOT NULL AND length(v_note) > 2000 THEN
    RETURN jsonb_build_object('status', 'invalid_event');
  END IF;

  BEGIN
    v_claimed_nil := NULLIF(btrim(COALESCE(p_claimed_nil_account_id, '')), '')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN jsonb_build_object('status', 'invalid_event');
  END;

  v_lock_a := 'event:' || p_event_id;
  v_lock_b := 'idem:' || p_idempotency_key;
  IF v_lock_a < v_lock_b THEN
    v_first := v_lock_a;
    v_second := v_lock_b;
  ELSE
    v_first := v_lock_b;
    v_second := v_lock_a;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_first, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(v_second, 0));

  SELECT supabase_user_id, clerk_user_id
    INTO v_user, v_clerk
  FROM public.recruiting_houze_athlete_links
  WHERE houze_athlete_id = p_houze_athlete_id
    AND revoked_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1 FROM public.recruiting_houze_athlete_links
      WHERE houze_athlete_id = p_houze_athlete_id
        AND revoked_at IS NOT NULL
    ) THEN
      RETURN jsonb_build_object('status', 'mapping_revoked');
    END IF;
    RETURN jsonb_build_object('status', 'mapping_missing');
  END IF;

  IF v_claimed_nil IS NOT NULL AND v_claimed_nil IS DISTINCT FROM v_user THEN
    RETURN jsonb_build_object('status', 'mapping_mismatch');
  END IF;
  IF NULLIF(btrim(COALESCE(p_claimed_clerk_user_id, '')), '') IS NOT NULL AND (
    v_clerk IS NULL
    OR v_clerk IS DISTINCT FROM p_claimed_clerk_user_id
    OR p_claimed_clerk_user_id = v_user::text
  ) THEN
    RETURN jsonb_build_object('status', 'mapping_mismatch');
  END IF;

  v_hash := public.recruiting_receiver_content_hash(
    'athlete-houze.recruiting.event.v1',
    p_houze_athlete_id,
    p_entity_type,
    p_entity_id,
    p_revision,
    p_occurred_at,
    btrim(p_title),
    p_status,
    v_note
  );

  SELECT count(*) INTO v_existing_count
  FROM public.recruiting_inbound_receipts
  WHERE event_id = p_event_id OR idempotency_key = p_idempotency_key;

  IF v_existing_count > 1 THEN
    RETURN jsonb_build_object('status', 'conflict');
  END IF;

  IF v_existing_count = 1 THEN
    SELECT * INTO v_existing
    FROM public.recruiting_inbound_receipts
    WHERE event_id = p_event_id OR idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF v_existing.supabase_user_id IS DISTINCT FROM v_user
       OR v_existing.houze_athlete_id IS DISTINCT FROM p_houze_athlete_id
       OR v_existing.event_id IS DISTINCT FROM p_event_id
       OR v_existing.idempotency_key IS DISTINCT FROM p_idempotency_key
       OR v_existing.content_hash IS DISTINCT FROM v_hash
       OR v_existing.entity_type IS DISTINCT FROM p_entity_type
       OR v_existing.entity_id IS DISTINCT FROM p_entity_id
       OR v_existing.revision IS DISTINCT FROM p_revision
    THEN
      RETURN jsonb_build_object('status', 'conflict');
    END IF;

    RETURN jsonb_build_object('status', 'ok', 'acknowledgement', v_existing.acknowledgement);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'entity:' || v_user::text || ':' || p_entity_type || ':' || p_entity_id,
    0
  ));

  SELECT revision, content_hash
    INTO v_current_revision, v_current_hash
  FROM public.recruiting_received_entities
  WHERE supabase_user_id = v_user
    AND entity_type = p_entity_type
    AND entity_id = p_entity_id
  FOR UPDATE;

  IF FOUND AND p_revision < v_current_revision THEN
    v_outcome := 'current_revision_newer';
    v_applied := false;
  ELSIF FOUND AND p_revision = v_current_revision AND v_current_hash IS DISTINCT FROM v_hash THEN
    RETURN jsonb_build_object('status', 'conflict');
  ELSIF FOUND AND p_revision = v_current_revision THEN
    v_outcome := 'current_revision_matches';
    v_applied := false;
    v_current_revision := p_revision;
  ELSE
    v_outcome := 'applied';
    v_applied := true;
    v_current_revision := p_revision;
    v_payload := jsonb_build_object('status', p_status, 'title', btrim(p_title));
    IF v_note IS NOT NULL THEN
      v_payload := v_payload || jsonb_build_object('note', v_note);
    END IF;
    INSERT INTO public.recruiting_received_entities (
      supabase_user_id, entity_type, entity_id, revision, content_hash,
      title, status, note, occurred_at, payload, updated_at
    ) VALUES (
      v_user, p_entity_type, p_entity_id, p_revision, v_hash,
      btrim(p_title), p_status, v_note, p_occurred_at::timestamptz, v_payload, now()
    )
    ON CONFLICT (supabase_user_id, entity_type, entity_id) DO UPDATE
      SET revision = EXCLUDED.revision,
          content_hash = EXCLUDED.content_hash,
          title = EXCLUDED.title,
          status = EXCLUDED.status,
          note = EXCLUDED.note,
          occurred_at = EXCLUDED.occurred_at,
          payload = EXCLUDED.payload,
          updated_at = now()
      WHERE public.recruiting_received_entities.revision < EXCLUDED.revision;
  END IF;

  v_ack := jsonb_build_object(
    'schemaVersion', 'athlete-houze.recruiting.ack.v1',
    'eventId', p_event_id,
    'idempotencyKey', p_idempotency_key,
    'houzeAthleteId', p_houze_athlete_id,
    'nilAccountId', v_user,
    'entityType', p_entity_type,
    'entityId', p_entity_id,
    'requestedRevision', p_revision,
    'currentRevision', v_current_revision,
    'revisionOutcome', v_outcome,
    'applied', v_applied
  );

  INSERT INTO public.recruiting_inbound_receipts (
    event_id, idempotency_key, supabase_user_id, houze_athlete_id,
    entity_type, entity_id, revision, content_hash, acknowledgement
  ) VALUES (
    p_event_id, p_idempotency_key, v_user, p_houze_athlete_id,
    p_entity_type, p_entity_id, p_revision, v_hash, v_ack
  );

  RETURN jsonb_build_object('status', 'ok', 'acknowledgement', v_ack);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('status', 'conflict');
END;
$$;

REVOKE ALL ON FUNCTION public.recruiting_receiver_content_canonical(text, text, text, text, integer, text, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.recruiting_receiver_content_hash(text, text, text, text, integer, text, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.commit_recruiting_inbound_event(text, text, text, text, text, text, text, integer, text, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.recruiting_receiver_content_canonical(text, text, text, text, integer, text, text, text, text)
  TO nil_recruiting_receiver_owner;
GRANT EXECUTE ON FUNCTION public.recruiting_receiver_content_hash(text, text, text, text, integer, text, text, text, text)
  TO nil_recruiting_receiver_owner;
GRANT EXECUTE ON FUNCTION public.commit_recruiting_inbound_event(text, text, text, text, text, text, text, integer, text, text, text, text)
  TO nil_recruiting_receiver_owner, nil_recruiting_receiver;

ALTER FUNCTION public.recruiting_receiver_content_canonical(text, text, text, text, integer, text, text, text, text)
  OWNER TO nil_recruiting_receiver_owner;
ALTER FUNCTION public.recruiting_receiver_content_hash(text, text, text, text, integer, text, text, text, text)
  OWNER TO nil_recruiting_receiver_owner;
ALTER FUNCTION public.commit_recruiting_inbound_event(text, text, text, text, text, text, text, integer, text, text, text, text)
  OWNER TO nil_recruiting_receiver_owner;
