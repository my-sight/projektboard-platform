-- Adds an RLS policy so board members (and the superuser) may edit Kanban cards.
begin;

drop policy if exists "Board members manage board cards" on public.kanban_cards;

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

commit;
