drop function if exists admin_list_discord_status();
drop function if exists admin_disconnect_discord(uuid);
drop function if exists disconnect_my_discord();

drop table if exists discord_presence;

alter table profiles
  drop column if exists discord_id,
  drop column if exists discord_username;
