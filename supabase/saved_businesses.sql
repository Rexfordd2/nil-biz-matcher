-- Saved businesses table and RLS policies
create extension if not exists pgcrypto;

create table if not exists public.saved_businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null,
  name text not null,
  address text null,
  lat double precision null,
  lng double precision null,
  phone text null,
  website text null,
  rating numeric null,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, place_id)
);

alter table public.saved_businesses enable row level security;

drop policy if exists "select-own" on public.saved_businesses;
create policy "select-own"
  on public.saved_businesses
  for select
  using (user_id = auth.uid());

drop policy if exists "insert-own" on public.saved_businesses;
create policy "insert-own"
  on public.saved_businesses
  for insert
  with check (user_id = auth.uid());

drop policy if exists "update-own" on public.saved_businesses;
create policy "update-own"
  on public.saved_businesses
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "delete-own" on public.saved_businesses;
create policy "delete-own"
  on public.saved_businesses
  for delete
  using (user_id = auth.uid());


