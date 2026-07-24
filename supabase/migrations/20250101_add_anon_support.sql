-- Migration: Add anonymous user support
-- Safe to run multiple times due to IF NOT EXISTS guards
-- Hobby-safe and client-safe with RLS policies

-- ============================================================================
-- 1. Ensure waitlist exists, then add anon_id column and index
-- ============================================================================

-- Waitlist historically lived in supabase/waitlist.sql (outside migrations).
-- Create it here so clean local resets can apply this migration.
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  anon_id text,
  source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  created_at timestamptz not null default now()
);

-- Add anon_id column to waitlist (nullable, for backward compatibility)
alter table if exists public.waitlist
  add column if not exists anon_id text;

-- Create index on anon_id for waitlist queries
create index if not exists idx_waitlist_anon_id on public.waitlist(anon_id);

-- ============================================================================
-- 2. Create anon_sessions table
-- ============================================================================

create table if not exists public.anon_sessions (
  anon_id text primary key,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

-- Create index on last_seen for cleanup queries
create index if not exists idx_anon_sessions_last_seen on public.anon_sessions(last_seen);

-- Enable RLS
alter table public.anon_sessions enable row level security;

-- Drop existing policies if they exist (for idempotency)
drop policy if exists "Allow anonymous anon_sessions inserts" on public.anon_sessions;
drop policy if exists "Deny anonymous anon_sessions selects" on public.anon_sessions;
drop policy if exists "Deny anonymous anon_sessions updates" on public.anon_sessions;
drop policy if exists "Deny anonymous anon_sessions deletes" on public.anon_sessions;
drop policy if exists "Allow authenticated anon_sessions reads" on public.anon_sessions;

-- Policy: Allow anonymous users to insert their own session
create policy "Allow anonymous anon_sessions inserts"
  on public.anon_sessions
  for insert
  to anon
  with check (true);

-- Policy: Deny anonymous updates
create policy "Deny anonymous anon_sessions updates"
  on public.anon_sessions
  for update
  to anon
  using (false);

-- Policy: Deny anonymous selects (anon users cannot read sessions)
create policy "Deny anonymous anon_sessions selects"
  on public.anon_sessions
  for select
  to anon
  using (false);

-- Policy: Deny anonymous deletes
create policy "Deny anonymous anon_sessions deletes"
  on public.anon_sessions
  for delete
  to anon
  using (false);

-- Policy: Allow authenticated users to read (for admin purposes)
create policy "Allow authenticated anon_sessions reads"
  on public.anon_sessions
  for select
  to authenticated
  using (true);

-- ============================================================================
-- 3. Create user_data table
-- ============================================================================

create table if not exists public.user_data (
  id uuid primary key default gen_random_uuid(),
  anon_id text not null,
  data_type text not null, -- e.g. 'discover_search', 'recruiting_search', 'profile_draft'
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- Create indexes for common queries
create index if not exists idx_user_data_anon_id on public.user_data(anon_id);
create index if not exists idx_user_data_data_type on public.user_data(data_type);
create index if not exists idx_user_data_created_at on public.user_data(created_at);
create index if not exists idx_user_data_anon_id_data_type on public.user_data(anon_id, data_type);

-- Enable RLS
alter table public.user_data enable row level security;

-- Drop existing policies if they exist (for idempotency)
drop policy if exists "Allow anonymous user_data inserts" on public.user_data;
drop policy if exists "Deny anonymous user_data selects" on public.user_data;
drop policy if exists "Deny anonymous user_data updates" on public.user_data;
drop policy if exists "Deny anonymous user_data deletes" on public.user_data;
drop policy if exists "Allow authenticated user_data reads" on public.user_data;

-- Policy: Allow anonymous users to insert data
create policy "Allow anonymous user_data inserts"
  on public.user_data
  for insert
  to anon
  with check (true);

-- Policy: Deny anonymous selects (anon users cannot read data)
create policy "Deny anonymous user_data selects"
  on public.user_data
  for select
  to anon
  using (false);

-- Policy: Deny anonymous updates
create policy "Deny anonymous user_data updates"
  on public.user_data
  for update
  to anon
  using (false);

-- Policy: Deny anonymous deletes
create policy "Deny anonymous user_data deletes"
  on public.user_data
  for delete
  to anon
  using (false);

-- Policy: Allow authenticated users to read (for admin purposes)
create policy "Allow authenticated user_data reads"
  on public.user_data
  for select
  to authenticated
  using (true);

-- ============================================================================
-- 4. Function to update last_seen timestamp (for anon_sessions)
-- ============================================================================

-- Helper function to update last_seen on anon_sessions
-- Can be called via SQL or used in triggers
create or replace function public.update_anon_session_last_seen(anon_id_param text)
returns void
language plpgsql
security definer
as $$
begin
  update public.anon_sessions
  set last_seen = now()
  where anon_sessions.anon_id = anon_id_param;
  
  -- If no row exists, insert one
  if not found then
    insert into public.anon_sessions (anon_id, created_at, last_seen)
    values (anon_id_param, now(), now())
    on conflict (anon_id) do update
    set last_seen = now();
  end if;
end;
$$;

-- Grant execute permission to anon role
grant execute on function public.update_anon_session_last_seen(text) to anon;
