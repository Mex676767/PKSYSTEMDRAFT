-- Sessions abandoned by closing the tab never got an ended_at, so the
-- activity history showed every one of them as "-> now". Close them at their
-- last heartbeat: once for existing rows, and from now on whenever
-- touch_presence() starts a fresh session.
update login_sessions
set ended_at = last_heartbeat_at
where ended_at is null
  and last_heartbeat_at <= now() - interval '2 minutes';

create or replace function touch_presence()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  open_session_id uuid;
begin
  update profiles set last_seen_at = now() where id = auth.uid();

  select id into open_session_id
  from login_sessions
  where user_id = auth.uid()
    and ended_at is null
    and last_heartbeat_at > now() - interval '2 minutes'
  order by started_at desc
  limit 1;

  if open_session_id is not null then
    update login_sessions set last_heartbeat_at = now() where id = open_session_id;
  else
    update login_sessions
    set ended_at = last_heartbeat_at
    where user_id = auth.uid() and ended_at is null;

    insert into login_sessions (user_id) values (auth.uid());
  end if;
end;
$$;

grant execute on function touch_presence() to authenticated;
