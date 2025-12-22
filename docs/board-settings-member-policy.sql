-- Allows board members (and the superuser) to manage board settings alongside the owner.
begin;

drop policy if exists "Board members manage board settings" on public.kanban_board_settings;

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

commit;
