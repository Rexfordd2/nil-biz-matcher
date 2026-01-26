-- Extend recruiting orgs for Google Places integration
-- Safe/idempotent migration: use IF NOT EXISTS for additive changes

-- Add columns for Places-backed orgs
alter table public.orgs
  add column if not exists place_id text,
  add column if not exists address text,
  add column if not exists source text default 'places';

-- Unique per-user place_id (allow nulls)
create unique index if not exists uniq_orgs_owner_place
  on public.orgs(owner_id, place_id)
  where place_id is not null;

-- Helpful lookup index on place_id (nullable)
create index if not exists idx_orgs_place_id on public.orgs(place_id);

-- Notes:
-- - We deliberately avoid storing permanent geometry; fetch via place_id when needed.
-- - 'source' defaults to 'places' but existing rows remain unchanged.

-- Migration: augment orgs for Google Places-powered Explore Map
-- Safe to run multiple times

-- Add columns if missing
alter table if exists public.orgs
  add column if not exists place_id text,
  add column if not exists address text,
  add column if not exists source text;

-- Default value for source
do $$
begin
  if not exists (
    select 1
    from pg_attrdef d
    join pg_class c on c.oid = d.adrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
    where n.nspname = 'public'
      and c.relname = 'orgs'
      and a.attname = 'source'
  ) then
    alter table public.orgs alter column source set default 'places';
  end if;
exception when others then
  -- best-effort default; ignore if fails due to permissions
  null;
end $$;

-- Unique constraint on (owner_id, place_id) to prevent duplicates per user
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orgs_owner_id_place_id_key'
  ) then
    alter table public.orgs
      add constraint orgs_owner_id_place_id_key unique (owner_id, place_id);
  end if;
end $$;

-- Helpful indexes
create index if not exists idx_orgs_place_id on public.orgs(place_id);
create index if not exists idx_orgs_source on public.orgs(source);

-- Recruiting Places support (Google Places integration)
-- Idempotent migration: safe to run multiple times

-- 1) Columns for Places-backed orgs
alter table if exists public.orgs
  add column if not exists place_id text,
  add column if not exists address text,
  add column if not exists source text not null default 'places';

-- 2) Ensure uniqueness per-owner for place-based orgs (nullable-safe via partial unique index)
create unique index if not exists uniq_orgs_owner_place
  on public.orgs(owner_id, place_id)
  where place_id is not null;

-- 3) Helpful lookup indexes
create index if not exists idx_orgs_place_id on public.orgs(place_id);
create index if not exists idx_orgs_owner_place on public.orgs(owner_id, place_id);

-- Notes:
-- - We intentionally do not persist geometry (lat/lng). Use place_id to fetch details when rendering.
-- - 'source' tracks data provenance; default is 'places'.

-- Optional column comments
do $$
begin
  if not exists (select 1 from pg_description d join pg_class c on d.objoid = c.oid where c.relname = 'orgs' and d.description like '%Google Places place_id%') then
    comment on column public.orgs.place_id is 'Google Places place_id for the organization';
  end if;
  if not exists (select 1 from pg_description d join pg_class c on d.objoid = c.oid where c.relname = 'orgs' and d.description like '%Data source identifier%') then
    comment on column public.orgs.source is 'Data source identifier (e.g., places)';
  end if;
  if not exists (select 1 from pg_description d join pg_class c on d.objoid = c.oid where c.relname = 'orgs' and d.description like '%Formatted address string%') then
    comment on column public.orgs.address is 'Formatted address string (do not rely on stored lat/lng)';
  end if;
end $$;

-- Recruiting Places extensions to support Google Places IDs and minimal fields
-- Safe to run multiple times; uses IF NOT EXISTS where possible

-- Add columns to orgs
alter table if exists public.orgs
  add column if not exists place_id text,
  add column if not exists address text,
  add column if not exists source text default 'places';

-- Unique per owner when place_id is provided
-- Use a partial unique index so that multiple null place_id rows are allowed
create unique index if not exists ux_orgs_owner_place
  on public.orgs(owner_id, place_id)
  where place_id is not null;

-- Helpful index when querying by place_id directly (without owner)
create index if not exists idx_orgs_place_id on public.orgs(place_id);

-- Recruiting Places enhancements: add place_id, address, source and unique(owner_id, place_id)
-- Safe to run multiple times due to IF NOT EXISTS guards and conditional index creation

-- 1) Columns
alter table if exists public.orgs
  add column if not exists place_id text,
  add column if not exists address text,
  add column if not exists source text default 'places';

-- 2) Unique constraint per owner on place_id
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orgs_owner_place_unique'
  ) then
    alter table public.orgs
      add constraint orgs_owner_place_unique unique (owner_id, place_id);
  end if;
end$$;

-- 3) Helpful index for lookups by owner_id, place_id
create index if not exists idx_orgs_owner_place on public.orgs(owner_id, place_id);

-- Notes:
-- - We intentionally do not store lat/lng; rely on Google place_id to fetch geometry at render time.
-- - 'source' is informational; current default is 'places'.

-- Add Google Places support to orgs for map-based recruiting
-- Safe to run multiple times

-- Columns for Places integration
alter table if exists public.orgs
  add column if not exists place_id text;

alter table if exists public.orgs
  add column if not exists address text;

alter table if exists public.orgs
  add column if not exists source text not null default 'places';

-- Unique constraint per owner on place_id (nullable-safe via partial index)
create unique index if not exists uniq_orgs_owner_place
  on public.orgs(owner_id, place_id)
  where place_id is not null;

-- Helpful indexes
create index if not exists idx_orgs_place_id on public.orgs(place_id);

-- Notes:
-- - We intentionally do not persist geometry; fetch via place_id when rendering.
-- - source_url already exists and stores the Google Maps deep link.

-- Recruiting Places enhancements
-- Adds support for Google Places-backed orgs

-- Add place_id to orgs (nullable), source (default 'places'), and address (formatted address text)
alter table if exists public.orgs
  add column if not exists place_id text,
  add column if not exists source text not null default 'places',
  add column if not exists address text;

-- Ensure uniqueness per owner for place-based orgs
create unique index if not exists uniq_orgs_owner_place
  on public.orgs(owner_id, place_id)
  where place_id is not null;

-- Optional: comments
comment on column public.orgs.place_id is 'Google Places place_id for the organization';
comment on column public.orgs.source is 'Data source identifier (e.g., places)';
comment on column public.orgs.address is 'Formatted address string (do not rely on stored lat/lng)';


