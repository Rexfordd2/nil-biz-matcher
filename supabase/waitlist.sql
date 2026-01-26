-- Waitlist table for public landing page email capture
-- Safe to run multiple times due to IF NOT EXISTS guards

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text, -- 'landing', 'demo', etc.
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  created_at timestamptz not null default now()
);

-- Unique constraint on email to prevent duplicates
-- Drop existing index if it exists (non-unique), then create unique constraint
drop index if exists idx_waitlist_email;
create unique index if not exists idx_waitlist_email_unique on public.waitlist(email);
create index if not exists idx_waitlist_created_at on public.waitlist(created_at);

-- Enable RLS (Row Level Security)
alter table public.waitlist enable row level security;

-- Drop existing policies if they exist (for idempotency)
drop policy if exists "Allow anonymous waitlist inserts" on public.waitlist;
drop policy if exists "Allow authenticated waitlist reads" on public.waitlist;
drop policy if exists "Deny anonymous selects" on public.waitlist;
drop policy if exists "Deny anonymous updates" on public.waitlist;
drop policy if exists "Deny anonymous deletes" on public.waitlist;

-- Policy: Allow anonymous inserts ONLY (for public waitlist signup)
-- This is the ONLY operation anon users can perform
create policy "Allow anonymous waitlist inserts"
  on public.waitlist
  for insert
  to anon
  with check (true);

-- Policy: Allow authenticated users to insert (for admin/backfill purposes)
create policy "Allow authenticated waitlist inserts"
  on public.waitlist
  for insert
  to authenticated
  with check (true);

-- Policy: Only authenticated users can read (for admin purposes)
create policy "Allow authenticated waitlist reads"
  on public.waitlist
  for select
  to authenticated
  using (true);

-- Explicitly deny anonymous selects, updates, and deletes
-- (RLS defaults to deny, but being explicit for security)
create policy "Deny anonymous selects"
  on public.waitlist
  for select
  to anon
  using (false);

create policy "Deny anonymous updates"
  on public.waitlist
  for update
  to anon
  using (false);

create policy "Deny anonymous deletes"
  on public.waitlist
  for delete
  to anon
  using (false);
