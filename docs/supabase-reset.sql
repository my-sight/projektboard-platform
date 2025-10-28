-- Reset and rebuild the Projektboard schema.
-- ⚠️ This script DROPS existing tables and functions before recreating them.
--    Run it only if you are comfortable losing the current board/profile data.
--
-- Recommended execution order:
--   1. Open Supabase SQL editor.
--   2. Paste this script.
--   3. Execute in a single transaction.
--
-- The script assumes the `pgcrypto` extension is available (default on Supabase)
-- so that `gen_random_uuid()` works.

begin;

set search_path = public;

-- ---------------------------------------------------------------------------
-- Drop legacy objects so we can recreate a clean schema
-- ---------------------------------------------------------------------------

-- helper triggers/functions
drop trigger if exists set_departments_updated_at on public.departments;
drop trigger if exists set_profiles_updated_at on public.profiles;
drop trigger if exists set_kanban_boards_updated_at on public.kanban_boards;
drop trigger if exists set_board_settings_updated_at on public.kanban_board_settings;
drop trigger if exists set_cards_updated_at on public.kanban_cards;
drop trigger if exists sync_profile_from_auth on auth.users;

drop function if exists public.handle_profiles_updated_at();
drop function if exists public.handle_kanban_boards_updated_at();
drop function if exists public.handle_board_settings_updated_at();
drop function if exists public.handle_kanban_cards_updated_at();
drop function if exists public.set_updated_at();
drop function if exists public.list_all_boards();
drop function if exists public.handle_new_auth_user();

-- legacy/unused tables from the earlier implementation
drop table if exists public.team_members cascade;
drop table if exists public.teams cascade;

-- main domain tables
drop table if exists public.board_escalation_history cascade;
drop table if exists public.board_escalations cascade;
drop table if exists public.board_top_topics cascade;
drop table if exists public.board_attendance cascade;
drop table if exists public.board_members cascade;
drop table if exists public.kanban_cards cascade;
drop table if exists public.kanban_board_settings cascade;
drop table if exists public.kanban_boards cascade;
drop table if exists public.departments cascade;
drop table if exists public.profiles cascade;

-- ---------------------------------------------------------------------------
-- Helper function for automatic updated_at handling
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Core data tables
-- ---------------------------------------------------------------------------

create table public.departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

create trigger set_departments_updated_at
  before update on public.departments
  for each row
  execute function public.set_updated_at();

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text,
  avatar_url  text,
  bio         text,
  company     text,
  role        text not null default 'user',
  is_active   boolean not null default true,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, company, is_active)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), new.email),
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'user'),
    nullif(new.raw_user_meta_data->>'company', ''),
    true
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
        role = coalesce(nullif(excluded.role, ''), public.profiles.role),
        company = coalesce(excluded.company, public.profiles.company),
        is_active = true;

  return new;
end;
$$;

create trigger sync_profile_from_auth
  after insert or update on auth.users
  for each row
  execute function public.handle_new_auth_user();

create table public.kanban_boards (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  settings     jsonb not null default '{"boardType":"standard"}'::jsonb,
  visibility   text not null default 'public' check (visibility in ('public', 'private')),
  owner_id     uuid references auth.users(id) on delete set null,
  user_id      uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default timezone('utc', now()),
  updated_at   timestamptz not null default timezone('utc', now())
);

create index kanban_boards_owner_idx on public.kanban_boards (owner_id);
create index kanban_boards_visibility_idx on public.kanban_boards (visibility);

create trigger set_kanban_boards_updated_at
  before update on public.kanban_boards
  for each row
  execute function public.set_updated_at();

create table public.kanban_board_settings (
  board_id    uuid primary key references public.kanban_boards(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

create trigger set_board_settings_updated_at
  before update on public.kanban_board_settings
  for each row
  execute function public.set_updated_at();

create table public.board_members (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references public.kanban_boards(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default timezone('utc', now())
);

create unique index board_members_unique on public.board_members (board_id, profile_id);

create table public.board_attendance (
  id           uuid primary key default gen_random_uuid(),
  board_id     uuid not null references public.kanban_boards(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  week_start   date not null,
  status       text not null default 'present' check (status in ('present', 'absent')),
  created_at   timestamptz not null default timezone('utc', now()),
  updated_at   timestamptz not null default timezone('utc', now()),
  constraint board_attendance_unique unique (board_id, profile_id, week_start)
);

create trigger set_board_attendance_updated_at
  before update on public.board_attendance
  for each row
  execute function public.set_updated_at();

create table public.board_top_topics (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references public.kanban_boards(id) on delete cascade,
  title       text not null default '',
  position    integer not null default 0,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

create index board_top_topics_board_position_idx on public.board_top_topics (board_id, position);

create trigger set_board_top_topics_updated_at
  before update on public.board_top_topics
  for each row
  execute function public.set_updated_at();

create table public.board_escalations (
  id                uuid primary key default gen_random_uuid(),
  board_id          uuid not null references public.kanban_boards(id) on delete cascade,
  card_id           text not null,
  category          text not null check (category in ('LK', 'SK')),
  project_code      text,
  project_name      text,
  reason            text,
  measure           text,
  department_id     uuid references public.departments(id) on delete set null,
  responsible_id    uuid references public.profiles(id) on delete set null,
  target_date       date,
  completion_steps  integer not null default 0 check (completion_steps between 0 and 4),
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now())
);

create index board_escalations_board_category_idx on public.board_escalations (board_id, category);
create unique index board_escalations_board_card_id_idx on public.board_escalations (board_id, card_id);

create trigger set_board_escalations_updated_at
  before update on public.board_escalations
  for each row
  execute function public.set_updated_at();

create table public.board_escalation_history (
  id             uuid primary key default gen_random_uuid(),
  board_id       uuid not null references public.kanban_boards(id) on delete cascade,
  card_id        text not null,
  escalation_id  uuid references public.board_escalations(id) on delete cascade,
  changed_by     uuid references public.profiles(id) on delete set null,
  changes        jsonb not null default '{}'::jsonb,
  changed_at     timestamptz not null default timezone('utc', now())
);

create index board_escalation_history_board_card_idx
  on public.board_escalation_history (board_id, card_id, changed_at desc);
create index board_escalation_history_escalation_idx
  on public.board_escalation_history (escalation_id, changed_at desc);

create table public.kanban_cards (
  id             uuid primary key default gen_random_uuid(),
  board_id       uuid not null references public.kanban_boards(id) on delete cascade,
  card_id        text not null,
  card_data      jsonb not null,
  stage          text,
  position       integer,
  project_number text,
  project_name   text,
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now())
);

create unique index kanban_cards_board_card_id_idx on public.kanban_cards (board_id, card_id);
create index kanban_cards_stage_idx on public.kanban_cards (board_id, stage, position);

create trigger set_cards_updated_at
  before update on public.kanban_cards
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security and policies
-- ---------------------------------------------------------------------------

alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.kanban_boards enable row level security;
alter table public.kanban_board_settings enable row level security;
alter table public.kanban_cards enable row level security;
alter table public.board_members enable row level security;
alter table public.board_attendance enable row level security;
alter table public.board_top_topics enable row level security;
alter table public.board_escalations enable row level security;
alter table public.board_escalation_history enable row level security;

-- Departments: allow everyone signed-in to read; mutations handled via service role.
create policy "Authenticated users can read departments"
  on public.departments
  for select
  using (auth.role() = 'authenticated');

-- Profiles: allow signed-in users to read everyone and edit themselves.
create policy "Authenticated users can read profiles"
  on public.profiles
  for select
  using (auth.role() = 'authenticated');

create policy "Users can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Boards: public boards visible to all authenticated users.
create policy "Authenticated users can read public boards"
  on public.kanban_boards
  for select
  using (visibility = 'public');

create policy "Board owners manage their boards"
  on public.kanban_boards
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Board settings inherit board visibility for reads; only owners may mutate.
create policy "Authenticated users can read board settings"
  on public.kanban_board_settings
  for select
  using (
    exists (
      select 1
      from public.kanban_boards b
      where b.id = board_id
        and b.visibility = 'public'
    )
  );

create policy "Board owners manage board settings"
  on public.kanban_board_settings
  for all
  using (
    exists (
      select 1
      from public.kanban_boards b
      where b.id = board_id
        and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.kanban_boards b
      where b.id = board_id
        and b.owner_id = auth.uid()
    )
  );

create policy "Board members manage board settings"
  on public.kanban_board_settings
  for all
  using (
    auth.email() = 'michael@mysight.net'
    or exists (
      select 1
      from public.board_members bm
      where bm.board_id = board_id
        and bm.profile_id = auth.uid()
    )
  )
  with check (
    auth.email() = 'michael@mysight.net'
    or exists (
      select 1
      from public.board_members bm
      where bm.board_id = board_id
        and bm.profile_id = auth.uid()
    )
  );

-- Cards: readable when the parent board is public; owners can mutate.
create policy "Authenticated users can read board cards"
  on public.kanban_cards
  for select
  using (
    exists (
      select 1
      from public.kanban_boards b
      where b.id = board_id
        and b.visibility = 'public'
    )
  );

create policy "Board owners manage board cards"
  on public.kanban_cards
  for all
  using (
    exists (
      select 1
      from public.kanban_boards b
      where b.id = board_id
        and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.kanban_boards b
      where b.id = board_id
        and b.owner_id = auth.uid()
    )
  );

create policy "Board members manage board cards"
  on public.kanban_cards
  for all
  using (
    auth.email() = 'michael@mysight.net'
    or exists (
      select 1
      from public.board_members bm
      where bm.board_id = board_id
        and bm.profile_id = auth.uid()
    )
  )
  with check (
    auth.email() = 'michael@mysight.net'
    or exists (
      select 1
      from public.board_members bm
      where bm.board_id = board_id
        and bm.profile_id = auth.uid()
    )
  );

-- Board management helpers
create policy "Authenticated users can read board members"
  on public.board_members
  for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users manage board members"
  on public.board_members
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can read attendance"
  on public.board_attendance
  for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users manage attendance"
  on public.board_attendance
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can read top topics"
  on public.board_top_topics
  for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users manage top topics"
  on public.board_top_topics
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can read escalations"
  on public.board_escalations
  for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users manage escalations"
  on public.board_escalations
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can read escalation history"
  on public.board_escalation_history
  for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can write escalation history"
  on public.board_escalation_history
  for insert
  with check (auth.role() = 'authenticated');

-- Aggregierte Ansichten für die Anwesenheitsübersicht
create or replace view public.board_attendance_weeks as
select
  board_id,
  week_start,
  min(created_at) as first_recorded_at
from public.board_attendance
group by board_id, week_start
order by board_id, week_start desc;

grant select on public.board_attendance_weeks to authenticated;

create or replace view public.board_attendance_matrix as
select
  ba.board_id,
  ba.week_start,
  jsonb_object_agg(ba.profile_id::text, jsonb_build_object('status', ba.status)) as statuses
from public.board_attendance ba
group by ba.board_id, ba.week_start
order by ba.board_id, ba.week_start desc;

grant select on public.board_attendance_matrix to authenticated;

create or replace view public.board_attendance_week_series as
with bounds as (
  select
    board_id,
    min(week_start) as first_week,
    greatest(max(week_start), date_trunc('week', current_date)::date) as last_week
  from public.board_attendance
  group by board_id
),
series as (
  select
    b.board_id,
    generate_series(b.first_week, b.last_week, interval '7 days')::date as week_start
  from bounds b
  union
  select
    kb.id as board_id,
    date_trunc('week', current_date)::date as week_start
  from public.kanban_boards kb
)
select
  s.board_id,
  s.week_start,
  coalesce(m.statuses, '{}'::jsonb) as statuses
from series s
left join public.board_attendance_matrix m
  on m.board_id = s.board_id
 and m.week_start = s.week_start
order by s.board_id, s.week_start desc;

grant select on public.board_attendance_week_series to authenticated;

-- ---------------------------------------------------------------------------
-- Helper function used by the frontend to list every public board
-- ---------------------------------------------------------------------------

create or replace function public.list_all_boards()
returns setof public.kanban_boards
language sql
security definer
set search_path = public
stable
as $$
  select *
  from public.kanban_boards
  where visibility = 'public'
  order by coalesce(updated_at, created_at) desc;
$$;

revoke all on function public.list_all_boards() from public;
grant execute on function public.list_all_boards() to authenticated;

commit;
