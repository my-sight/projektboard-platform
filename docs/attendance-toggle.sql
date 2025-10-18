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
