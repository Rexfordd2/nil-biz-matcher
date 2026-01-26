-- Safe migration: add notes and source_url to org_contacts if not present
alter table public.org_contacts add column if not exists notes text;
alter table public.org_contacts add column if not exists source_url text;


