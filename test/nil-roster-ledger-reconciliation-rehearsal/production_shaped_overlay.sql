-- Rehearsal overlay for LOCAL Supabase auth.users schema.
-- Synthetic only. No production content. No secrets printed by callers.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure five synthetic auth users exist (local GoTrue-compatible minimal insert)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
VALUES
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated',
   'fixture-a@example.invalid', crypt('local-fixture-only', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated',
   'fixture-b@example.invalid', crypt('local-fixture-only', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated',
   'fixture-c@example.invalid', crypt('local-fixture-only', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated',
   'fixture-d@example.invalid', crypt('local-fixture-only', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '55555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated',
   'fixture-e@example.invalid', crypt('local-fixture-only', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
  ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111',
   '{"sub":"11111111-1111-4111-8111-111111111111","email":"fixture-a@example.invalid"}'::jsonb, 'email', now(), now(), now()),
  ('22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222',
   '{"sub":"22222222-2222-4222-8222-222222222222","email":"fixture-b@example.invalid"}'::jsonb, 'email', now(), now(), now()),
  ('33333333-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333',
   '{"sub":"33333333-3333-4333-8333-333333333333","email":"fixture-c@example.invalid"}'::jsonb, 'email', now(), now(), now()),
  ('44444444-4444-4444-8444-444444444444', '44444444-4444-4444-8444-444444444444',
   '{"sub":"44444444-4444-4444-8444-444444444444","email":"fixture-d@example.invalid"}'::jsonb, 'email', now(), now(), now()),
  ('55555555-5555-4555-8555-555555555555', '55555555-5555-4555-8555-555555555555',
   '{"sub":"55555555-5555-4555-8555-555555555555","email":"fixture-e@example.invalid"}'::jsonb, 'email', now(), now(), now())
ON CONFLICT DO NOTHING;

INSERT INTO public.profiles (id, email, full_name, user_id)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'fixture-a@example.invalid', 'Fixture A', '11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222', 'fixture-b@example.invalid', 'Fixture B', '22222222-2222-4222-8222-222222222222'),
  ('33333333-3333-4333-8333-333333333333', 'fixture-c@example.invalid', 'Fixture C', '33333333-3333-4333-8333-333333333333'),
  ('44444444-4444-4444-8444-444444444444', 'fixture-d@example.invalid', 'Fixture D', '44444444-4444-4444-8444-444444444444'),
  ('55555555-5555-4555-8555-555555555555', 'fixture-e@example.invalid', 'Fixture E', '55555555-5555-4555-8555-555555555555')
ON CONFLICT (id) DO NOTHING;

DELETE FROM public.waitlist WHERE email LIKE 'fixture-waitlist%@example.invalid';
INSERT INTO public.waitlist (email, source)
VALUES
  ('fixture-waitlist-1@example.invalid', 'fixture'),
  ('fixture-waitlist-2@example.invalid', 'fixture'),
  ('fixture-waitlist-3@example.invalid', 'fixture');

INSERT INTO public.athlete_profiles (user_id, profile)
VALUES
  ('11111111-1111-4111-8111-111111111111', '{"fixture":true,"n":1}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', '{"fixture":true,"n":2}'::jsonb),
  ('33333333-3333-4333-8333-333333333333', '{"fixture":true,"n":3}'::jsonb),
  ('44444444-4444-4444-8444-444444444444', '{"fixture":true,"n":4}'::jsonb),
  ('55555555-5555-4555-8555-555555555555', '{"fixture":true,"n":5}'::jsonb)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.businesses (place_id, name)
VALUES
  ('fixture-place-1', 'Fixture Business 1'),
  ('fixture-place-2', 'Fixture Business 2')
ON CONFLICT (place_id) DO NOTHING;

INSERT INTO public.user_businesses (user_id, place_id, status)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'fixture-place-1', 'saved'),
  ('22222222-2222-4222-8222-222222222222', 'fixture-place-2', 'saved')
ON CONFLICT DO NOTHING;

INSERT INTO public.saved_businesses (user_id, place_id, name)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'fixture-place-1', 'Fixture Business 1'),
  ('22222222-2222-4222-8222-222222222222', 'fixture-place-2', 'Fixture Business 2')
ON CONFLICT DO NOTHING;

-- Model empty migration ledger (production-shaped condition)
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  statements text[],
  name text
);
TRUNCATE supabase_migrations.schema_migrations;
