-- Normalise historische Anwesenheitswerte auf das neue present/absent-Modell
update public.board_attendance
set status = case
  when status in ('absent', 'sick', 'vacation', 'remote') then 'absent'
  else 'present'
end;

-- Standardwert und Check-Constraint setzen
alter table public.board_attendance
  alter column status set default 'present';

do $$
begin
  if exists (
    select 1
    from information_schema.constraint_column_usage
    where table_schema = 'public'
      and table_name = 'board_attendance'
      and constraint_name = 'board_attendance_status_check'
  ) then
    alter table public.board_attendance drop constraint board_attendance_status_check;
  end if;
end;
$$;

alter table public.board_attendance
  add constraint board_attendance_status_check
  check (status in ('present', 'absent'));

-- Index zur schnelleren Abfrage nach Board und Kalenderwoche
create index if not exists board_attendance_board_week_idx
  on public.board_attendance (board_id, week_start desc);

-- Optionale Sicht, die jede gespeicherte KW nur einmal zurückliefert
create or replace view public.board_attendance_weeks as
select
  board_id,
  week_start,
  min(created_at) as first_recorded_at
from public.board_attendance
group by board_id, week_start
order by board_id, week_start desc;

grant select on public.board_attendance_weeks to authenticated;

-- Matrix-View für die neue Anwesenheitstabelle im Management-Panel
create or replace view public.board_attendance_matrix as
select
  ba.board_id,
  ba.week_start,
  jsonb_object_agg(ba.profile_id::text, jsonb_build_object('status', ba.status)) as statuses
from public.board_attendance ba
group by ba.board_id, ba.week_start
order by ba.board_id, ba.week_start desc;

grant select on public.board_attendance_matrix to authenticated;

-- Lückenlose Wochenliste je Board inkl. aktueller Kalenderwoche
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
