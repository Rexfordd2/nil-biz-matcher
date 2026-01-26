-- Recruiting schema: orgs, org_contacts, user_targets
-- Safe to run multiple times due to IF NOT EXISTS guards

-- Enable extensions (Supabase has these pre-enabled, guards included for safety)
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- A) orgs
create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sport text,
  level text, -- club/college/semi-pro/pro/other
  org_type text, -- school/team/club/league/association/other
  country text,
  region text,
  city text,
  website_url text,
  general_email text,
  general_phone text,
  notes text,
  source_url text,
  visibility text not null default 'private', -- private or shared later
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- Indexes for filtering and ownership
create index if not exists idx_orgs_owner_id on public.orgs(owner_id);
create index if not exists idx_orgs_sport on public.orgs(sport);
create index if not exists idx_orgs_level on public.orgs(level);
create index if not exists idx_orgs_org_type on public.orgs(org_type);
create index if not exists idx_orgs_country on public.orgs(country);
create index if not exists idx_orgs_region on public.orgs(region);
create index if not exists idx_orgs_city on public.orgs(city);

-- B) org_contacts
create table if not exists public.org_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  role text,
  name text,
  email text,
  phone text,
  contact_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_org_contacts_org_id on public.org_contacts(org_id);

-- C) user_targets
create table if not exists public.user_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  org_id uuid not null references public.orgs(id) on delete cascade,
  status text not null default 'To Contact',
  tags text[] not null default '{}',
  notes text,
  next_followup_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, org_id)
);

create index if not exists idx_user_targets_user_id on public.user_targets(user_id);
create index if not exists idx_user_targets_org_id on public.user_targets(org_id);
create index if not exists idx_user_targets_status on public.user_targets(status);
create index if not exists idx_user_targets_next_followup on public.user_targets(next_followup_at);

-- Trigger to maintain updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_user_targets_updated_at on public.user_targets;
create trigger trg_user_targets_updated_at
before update on public.user_targets
for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.orgs enable row level security;
alter table public.org_contacts enable row level security;
alter table public.user_targets enable row level security;

-- Orgs policies: only owner can read/write
drop policy if exists orgs_select_own on public.orgs;
create policy orgs_select_own
  on public.orgs
  for select
  using (owner_id = auth.uid());

drop policy if exists orgs_insert_own on public.orgs;
create policy orgs_insert_own
  on public.orgs
  for insert
  with check (owner_id = auth.uid());

drop policy if exists orgs_update_own on public.orgs;
create policy orgs_update_own
  on public.orgs
  for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists orgs_delete_own on public.orgs;
create policy orgs_delete_own
  on public.orgs
  for delete
  using (owner_id = auth.uid());

-- Org contacts policies: only visible/editable if parent org is owned by user
drop policy if exists org_contacts_select_own on public.org_contacts;
create policy org_contacts_select_own
  on public.org_contacts
  for select
  using (exists (
    select 1 from public.orgs o
    where o.id = org_id and o.owner_id = auth.uid()
  ));

drop policy if exists org_contacts_insert_own on public.org_contacts;
create policy org_contacts_insert_own
  on public.org_contacts
  for insert
  with check (exists (
    select 1 from public.orgs o
    where o.id = org_id and o.owner_id = auth.uid()
  ));

drop policy if exists org_contacts_update_own on public.org_contacts;
create policy org_contacts_update_own
  on public.org_contacts
  for update
  using (exists (
    select 1 from public.orgs o
    where o.id = org_id and o.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.orgs o
    where o.id = org_id and o.owner_id = auth.uid()
  ));

drop policy if exists org_contacts_delete_own on public.org_contacts;
create policy org_contacts_delete_own
  on public.org_contacts
  for delete
  using (exists (
    select 1 from public.orgs o
    where o.id = org_id and o.owner_id = auth.uid()
  ));

-- User targets policies: only visible/editable by user_id
drop policy if exists user_targets_select_own on public.user_targets;
create policy user_targets_select_own
  on public.user_targets
  for select
  using (user_id = auth.uid());

drop policy if exists user_targets_insert_own on public.user_targets;
create policy user_targets_insert_own
  on public.user_targets
  for insert
  with check (user_id = auth.uid());

drop policy if exists user_targets_update_own on public.user_targets;
create policy user_targets_update_own
  on public.user_targets
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists user_targets_delete_own on public.user_targets;
create policy user_targets_delete_own
  on public.user_targets
  for delete
  using (user_id = auth.uid());

-- Optional: comment describing the schema
comment on table public.orgs is 'Organizations in recruiting directory (per-user private by default)';
comment on table public.org_contacts is 'Contacts for organizations';
comment on table public.user_targets is 'User saved targets with statuses and follow-ups';


