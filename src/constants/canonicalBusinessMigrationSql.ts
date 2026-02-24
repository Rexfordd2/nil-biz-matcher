/**
 * Canonical businesses migration SQL for copy-to-clipboard (preflight gate).
 * Keep in sync with supabase/migrations/20260223_canonical_businesses_user_businesses.sql
 */
export const CANONICAL_BUSINESSES_MIGRATION_SQL = `-- Canonical businesses table (place_id unique) + user_businesses overlay (user_id + place_id)
-- Discover "Save" and Businesses tab use this as single source of truth.

-- ============================================================================
-- 1) businesses: canonical place data (shared)
-- ============================================================================
create table if not exists public.businesses (
  place_id text primary key,
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  phone text,
  website text,
  rating numeric,
  types text[] default '{}',
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.businesses enable row level security;

drop policy if exists "businesses_select_authenticated" on public.businesses;
create policy "businesses_select_authenticated"
  on public.businesses for select
  to authenticated
  using (true);

drop policy if exists "businesses_insert_authenticated" on public.businesses;
create policy "businesses_insert_authenticated"
  on public.businesses for insert
  to authenticated
  with check (true);

drop policy if exists "businesses_update_authenticated" on public.businesses;
create policy "businesses_update_authenticated"
  on public.businesses for update
  to authenticated
  using (true)
  with check (true);

-- ============================================================================
-- 2) user_businesses: per-user overlay (status, tags)
-- ============================================================================
create table if not exists public.user_businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null references public.businesses(place_id) on delete cascade,
  status text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, place_id)
);

create index if not exists idx_user_businesses_user_id on public.user_businesses(user_id);
create index if not exists idx_user_businesses_place_id on public.user_businesses(place_id);

alter table public.user_businesses enable row level security;

drop policy if exists "user_businesses_select_own" on public.user_businesses;
create policy "user_businesses_select_own"
  on public.user_businesses for select
  using (user_id = auth.uid());

drop policy if exists "user_businesses_insert_own" on public.user_businesses;
create policy "user_businesses_insert_own"
  on public.user_businesses for insert
  with check (user_id = auth.uid());

drop policy if exists "user_businesses_update_own" on public.user_businesses;
create policy "user_businesses_update_own"
  on public.user_businesses for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "user_businesses_delete_own" on public.user_businesses;
create policy "user_businesses_delete_own"
  on public.user_businesses for delete
  using (user_id = auth.uid());
`
