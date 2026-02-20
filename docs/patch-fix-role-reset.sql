-- Patch: Prevent handle_new_auth_user from overwriting the role on login
-- Issue: When a user logs in, auth.users is updated, firing this trigger.
-- The trigger was taking the role from raw_user_meta_data (defaulting to 'user')
-- and overwriting the role set in public.profiles.

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
        -- REMOVED or MODIFIED: Do not overwrite role from metadata on update
        -- role = coalesce(nullif(excluded.role, ''), public.profiles.role), 
        company = coalesce(excluded.company, public.profiles.company),
        is_active = true;

  return new;
end;
$$;
