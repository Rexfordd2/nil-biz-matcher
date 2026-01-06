-- 1) Profiles

create table if not exists public.profiles (

  id uuid primary key references auth.users(id) on delete cascade,

  role text not null default 'athlete' check (role in ('athlete','parent','coach')),

  display_name text,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()

);



-- 2) Athlete profile (1:1 with user)

create table if not exists public.athlete_profile (

  user_id uuid primary key references auth.users(id) on delete cascade,

  bio text,

  school text,

  grad_year int,

  positions text[] default '{}',

  height_inches int,

  weight_lbs int,

  gpa numeric(3,2),

  social_links jsonb not null default '{}'::jsonb,

  highlight_links jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()

);



-- 3) Onboarding progress

create table if not exists public.onboarding_progress (

  user_id uuid primary key references auth.users(id) on delete cascade,

  completed_steps jsonb not null default '[]'::jsonb,

  last_step text,

  percent_complete int not null default 0,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()

);



-- updated_at trigger helper

create or replace function public.set_updated_at()

returns trigger as $$

begin

  new.updated_at = now();

  return new;

end;

$$ language plpgsql;



drop trigger if exists trg_profiles_updated_at on public.profiles;

create trigger trg_profiles_updated_at

before update on public.profiles

for each row execute function public.set_updated_at();



drop trigger if exists trg_athlete_profile_updated_at on public.athlete_profile;

create trigger trg_athlete_profile_updated_at

before update on public.athlete_profile

for each row execute function public.set_updated_at();



drop trigger if exists trg_onboarding_updated_at on public.onboarding_progress;

create trigger trg_onboarding_updated_at

before update on public.onboarding_progress

for each row execute function public.set_updated_at();



-- Enable RLS

alter table public.profiles enable row level security;

alter table public.athlete_profile enable row level security;

alter table public.onboarding_progress enable row level security;



-- Policies: user can only access their own rows

drop policy if exists "profiles_select_own" on public.profiles;

create policy "profiles_select_own"

on public.profiles for select

using (auth.uid() = id);



drop policy if exists "profiles_upsert_own" on public.profiles;

create policy "profiles_upsert_own"

on public.profiles for insert

with check (auth.uid() = id);



drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_update_own"

on public.profiles for update

using (auth.uid() = id)

with check (auth.uid() = id);



drop policy if exists "athlete_select_own" on public.athlete_profile;

create policy "athlete_select_own"

on public.athlete_profile for select

using (auth.uid() = user_id);



drop policy if exists "athlete_insert_own" on public.athlete_profile;

create policy "athlete_insert_own"

on public.athlete_profile for insert

with check (auth.uid() = user_id);


-- === App additions: profiles extensions and recruiting_targets ===

-- Ensure required profiles columns for auth trigger alignment
alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists guardian_required boolean default false,
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz;

-- Recruiting targets per user
create table if not exists public.recruiting_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program jsonb not null,
  status text not null default 'not_contacted',
  created_at timestamptz not null default now()
);

alter table public.recruiting_targets enable row level security;

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



-- Insert profile row on new auth user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    guardian_required,
    terms_version,
    terms_accepted_at
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', ''),
    coalesce((new.raw_user_meta_data->>'guardianRequired')::boolean, false),
    new.raw_user_meta_data->>'termsVersion',
    (new.raw_user_meta_data->>'termsAcceptedAt')::timestamptz
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop policy if exists "athlete_update_own" on public.athlete_profile;

create policy "athlete_update_own"

on public.athlete_profile for update

using (auth.uid() = user_id)

with check (auth.uid() = user_id);



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


