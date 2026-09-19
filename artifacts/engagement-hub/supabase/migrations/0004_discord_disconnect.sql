create or replace function disconnect_my_discord()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles
  set discord_id = null, discord_username = null
  where id = auth.uid();
end;
$$;

grant execute on function disconnect_my_discord() to authenticated;

create or replace function admin_disconnect_discord(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin = true) then
    raise exception 'Not authorized';
  end if;

  update profiles
  set discord_id = null, discord_username = null
  where id = target_user;
end;
$$;

grant execute on function admin_disconnect_discord(uuid) to authenticated;
