create or replace function admin_list_discord_status()
returns table (id uuid, discord_id text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true) then
    raise exception 'Not authorized';
  end if;

  return query select profiles.id, profiles.discord_id from profiles;
end;
$$;

grant execute on function admin_list_discord_status() to authenticated;
