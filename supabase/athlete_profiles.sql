-- Athlete Profiles JSONB store
create schema if not exists public;

create table if not exists public.athlete_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.athlete_profiles enable row level security;

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_athlete_profiles_updated_at on public.athlete_profiles;
create trigger trg_athlete_profiles_updated_at
before update on public.athlete_profiles
for each row execute function public.set_updated_at();

-- RLS policies
drop policy if exists "Allow users to read own profile" on public.athlete_profiles;
create policy "Allow users to read own profile"
  on public.athlete_profiles
  for select
  using (user_id = auth.uid());

drop policy if exists "Allow users to insert own profile" on public.athlete_profiles;
create policy "Allow users to insert own profile"
  on public.athlete_profiles
  for insert
  with check (user_id = auth.uid());

drop policy if exists "Allow users to update own profile" on public.athlete_profiles;
create policy "Allow users to update own profile"
  on public.athlete_profiles
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

