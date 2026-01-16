-- Ensure the escalation history table exists so the management UI can
-- record who changed an escalation and when.

begin;

set search_path = public;

create table if not exists public.board_escalation_history (
  id             uuid primary key default gen_random_uuid(),
  board_id       uuid not null references public.kanban_boards(id) on delete cascade,
  card_id        text not null,
  escalation_id  uuid references public.board_escalations(id) on delete cascade,
  changed_by     uuid references public.profiles(id) on delete set null,
  changes        jsonb not null default '{}'::jsonb,
  changed_at     timestamptz not null default timezone('utc', now())
);

create index if not exists board_escalation_history_board_card_idx
  on public.board_escalation_history (board_id, card_id, changed_at desc);

create index if not exists board_escalation_history_escalation_idx
  on public.board_escalation_history (escalation_id, changed_at desc);

alter table public.board_escalation_history enable row level security;

create policy if not exists "Authenticated users can read escalation history"
  on public.board_escalation_history
  for select
  using (auth.role() = 'authenticated');

create policy if not exists "Authenticated users can write escalation history"
  on public.board_escalation_history
  for insert
  with check (auth.role() = 'authenticated');

commit;
