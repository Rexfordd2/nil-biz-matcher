-- Migration: Add user scoping to app-owned tables used in /app
-- Goal:
-- - Ensure a user_id uuid column exists (where missing)
-- - Enable RLS
-- - Ensure owner-only SELECT/INSERT/UPDATE/DELETE via policies
-- - Keep changes idempotent and minimal

-- ============================================================================
-- 1) Safe: Ensure user_id columns exist (uuid) — Option A (check table exists first)
-- ============================================================================

-- public.profiles: table uses id=auth.users(id); add generated user_id for consistency
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'user_id'
  ) then
    -- ensure source column exists before creating generated column
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'id'
    ) then
      alter table public.profiles
        add column user_id uuid generated always as (id) stored;
    end if;
  end if;
end $$;

-- public.orgs: table uses owner_id; add generated user_id alias for consistency
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'orgs'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orgs'
      and column_name = 'user_id'
  ) then
    -- ensure source column owner_id exists before creating generated column
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orgs'
        and column_name = 'owner_id'
    ) then
      alter table public.orgs
        add column user_id uuid generated always as (owner_id) stored;
    end if;
  end if;
end $$;

-- public.org_contacts: add user_id to support explicit scoping in queries
alter table if exists public.org_contacts
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Best-effort default for org_contacts.user_id to auth.uid()
do $$
begin
  -- only attempt to set default if table and column exist
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'org_contacts'
      and column_name = 'user_id'
  ) and exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'org_contacts'
  ) then
    begin
      alter table public.org_contacts alter column user_id set default auth.uid();
    exception when others then
      -- ignore failures (e.g., function auth.uid() not available in this context)
      null;
    end;
  end if;
end $$;

-- user_data already has user_id via prior migration; ensure column exists anyway (idempotent)
alter table if exists public.user_data
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- ============================================================================
-- 2) Ensure RLS is enabled
-- ============================================================================

alter table if exists public.profiles enable row level security;
alter table if exists public.athlete_profile enable row level security;
alter table if exists public.onboarding_progress enable row level security;
alter table if exists public.athlete_profiles enable row level security;
alter table if exists public.recruiting_targets enable row level security;
alter table if exists public.saved_businesses enable row level security;
alter table if exists public.user_data enable row level security;
alter table if exists public.orgs enable row level security;
alter table if exists public.org_contacts enable row level security;
alter table if exists public.user_targets enable row level security;

-- ============================================================================
-- 3) Policies: owner-only SELECT/INSERT/UPDATE/DELETE
-- ============================================================================

-- --- profiles (owner-only) ---
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = user_id);

drop policy if exists "profiles_upsert_own" on public.profiles;
create policy "profiles_upsert_own"
  on public.profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
  on public.profiles for delete
  using (auth.uid() = user_id);

-- --- athlete_profile (owner-only) ---
drop policy if exists "athlete_select_own" on public.athlete_profile;
create policy "athlete_select_own"
  on public.athlete_profile for select
  using (auth.uid() = user_id);

drop policy if exists "athlete_insert_own" on public.athlete_profile;
create policy "athlete_insert_own"
  on public.athlete_profile for insert
  with check (auth.uid() = user_id);

drop policy if exists "athlete_update_own" on public.athlete_profile;
create policy "athlete_update_own"
  on public.athlete_profile for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "athlete_delete_own" on public.athlete_profile;
create policy "athlete_delete_own"
  on public.athlete_profile for delete
  using (auth.uid() = user_id);

-- --- onboarding_progress (owner-only) ---
drop policy if exists "onboarding_select_own" on public.onboarding_progress;
create policy "onboarding_select_own"
  on public.onboarding_progress for select
  using (auth.uid() = user_id);

drop policy if exists "onboarding_insert_own" on public.onboarding_progress;
create policy "onboarding_insert_own"
  on public.onboarding_progress for insert
  with check (auth.uid() = user_id);

drop policy if exists "onboarding_update_own" on public.onboarding_progress;
create policy "onboarding_update_own"
  on public.onboarding_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "onboarding_delete_own" on public.onboarding_progress;
create policy "onboarding_delete_own"
  on public.onboarding_progress for delete
  using (auth.uid() = user_id);

-- --- athlete_profiles (owner-only) ---
drop policy if exists "Allow users to read own profile" on public.athlete_profiles;
create policy "Allow users to read own profile"
  on public.athlete_profiles for select
  using (user_id = auth.uid());

drop policy if exists "Allow users to insert own profile" on public.athlete_profiles;
create policy "Allow users to insert own profile"
  on public.athlete_profiles for insert
  with check (user_id = auth.uid());

drop policy if exists "Allow users to update own profile" on public.athlete_profiles;
create policy "Allow users to update own profile"
  on public.athlete_profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Allow users to delete own profile" on public.athlete_profiles;
create policy "Allow users to delete own profile"
  on public.athlete_profiles for delete
  using (user_id = auth.uid());

-- --- recruiting_targets (owner-only) ---
drop policy if exists "recruiting_targets_select_own" on public.recruiting_targets;
create policy "recruiting_targets_select_own"
  on public.recruiting_targets for select
  using (auth.uid() = user_id);

drop policy if exists "recruiting_targets_insert_own" on public.recruiting_targets;
create policy "recruiting_targets_insert_own"
  on public.recruiting_targets for insert
  with check (auth.uid() = user_id);

drop policy if exists "recruiting_targets_update_own" on public.recruiting_targets;
create policy "recruiting_targets_update_own"
  on public.recruiting_targets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "recruiting_targets_delete_own" on public.recruiting_targets;
create policy "recruiting_targets_delete_own"
  on public.recruiting_targets for delete
  using (auth.uid() = user_id);

-- --- saved_businesses (already owner-scoped; ensure delete exists with standard name) ---
-- (No-op if already present; keep existing policies in saved_businesses.sql)

-- --- user_data (authenticated owner-only; keep anon insert for anon flows) ---
drop policy if exists "Allow anonymous user_data inserts" on public.user_data;
drop policy if exists "Deny anonymous user_data selects" on public.user_data;
drop policy if exists "Deny anonymous user_data updates" on public.user_data;
drop policy if exists "Deny anonymous user_data deletes" on public.user_data;
drop policy if exists "Allow authenticated user_data reads" on public.user_data;
drop policy if exists "Users can read their own user_data" on public.user_data;
drop policy if exists "Users can insert their own user_data" on public.user_data;
drop policy if exists "Anonymous users can insert with anon_id" on public.user_data;

create policy "user_data_select_own"
  on public.user_data for select
  to authenticated
  using (user_id = auth.uid());

create policy "user_data_insert_own"
  on public.user_data for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "user_data_update_own"
  on public.user_data for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "user_data_delete_own"
  on public.user_data for delete
  to authenticated
  using (user_id = auth.uid());

create policy "user_data_anon_insert"
  on public.user_data for insert
  to anon
  with check (user_id is null and anon_id is not null);

create policy "user_data_anon_deny_select"
  on public.user_data for select
  to anon
  using (false);

create policy "user_data_anon_deny_update"
  on public.user_data for update
  to anon
  using (false);

create policy "user_data_anon_deny_delete"
  on public.user_data for delete
  to anon
  using (false);

-- --- orgs (owner-only; use user_id alias to match app scoping convention) ---
drop policy if exists orgs_select_own on public.orgs;
create policy orgs_select_own
  on public.orgs for select
  using (user_id = auth.uid());

drop policy if exists orgs_insert_own on public.orgs;
create policy orgs_insert_own
  on public.orgs for insert
  with check (user_id = auth.uid());

drop policy if exists orgs_update_own on public.orgs;
create policy orgs_update_own
  on public.orgs for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists orgs_delete_own on public.orgs;
create policy orgs_delete_own
  on public.orgs for delete
  using (user_id = auth.uid());

-- --- org_contacts (owner-only; must match both user_id and parent org ownership) ---
drop policy if exists org_contacts_select_own on public.org_contacts;
create policy org_contacts_select_own
  on public.org_contacts for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.orgs o
      where o.id = org_id and o.user_id = auth.uid()
    )
  );

drop policy if exists org_contacts_insert_own on public.org_contacts;
create policy org_contacts_insert_own
  on public.org_contacts for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.orgs o
      where o.id = org_id and o.user_id = auth.uid()
    )
  );

drop policy if exists org_contacts_update_own on public.org_contacts;
create policy org_contacts_update_own
  on public.org_contacts for update
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.orgs o
      where o.id = org_id and o.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.orgs o
      where o.id = org_id and o.user_id = auth.uid()
    )
  );

drop policy if exists org_contacts_delete_own on public.org_contacts;
create policy org_contacts_delete_own
  on public.org_contacts for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.orgs o
      where o.id = org_id and o.user_id = auth.uid()
    )
  );

-- --- user_targets (owner-only; ensure delete exists) ---
drop policy if exists user_targets_select_own on public.user_targets;
create policy user_targets_select_own
  on public.user_targets for select
  using (user_id = auth.uid());

drop policy if exists user_targets_insert_own on public.user_targets;
create policy user_targets_insert_own
  on public.user_targets for insert
  with check (user_id = auth.uid());

drop policy if exists user_targets_update_own on public.user_targets;
create policy user_targets_update_own
  on public.user_targets for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists user_targets_delete_own on public.user_targets;
create policy user_targets_delete_own
  on public.user_targets for delete
  using (user_id = auth.uid());

