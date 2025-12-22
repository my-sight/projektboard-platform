-- Ensure every board stores its type ("standard" vs "team") in the settings JSON.
-- Run this once after deploying the team board feature.

alter table public.kanban_boards
  alter column settings set default '{"boardType":"standard"}'::jsonb;

update public.kanban_boards
set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{boardType}', '"standard"', true)
where coalesce(settings->>'boardType', '') = '';

-- To convert an existing board into a team board replace the placeholder UUID
-- with the actual board id and execute the statement below.
-- update public.kanban_boards
-- set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{boardType}', '"team"', true)
-- where id = '00000000-0000-0000-0000-000000000000';
