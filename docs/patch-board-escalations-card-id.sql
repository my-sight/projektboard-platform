--
-- Stellt sicher, dass die Tabelle "board_escalations" die erwartete Spalte
-- "card_id" enthält und dass pro Board immer nur eine Eskalation je Karte
-- existiert. Das Skript ist idempotent und kann gefahrlos erneut ausgeführt
-- werden.
--
begin;

alter table public.board_escalations
  add column if not exists card_id text;

update public.board_escalations
set card_id = coalesce(card_id, project_code, id::text)
where card_id is null;

alter table public.board_escalations
  alter column card_id set not null;

drop index if exists board_escalations_board_card_id_idx;
create unique index board_escalations_board_card_id_idx
  on public.board_escalations (board_id, card_id);

commit;
