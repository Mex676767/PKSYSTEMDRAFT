alter table profiles
  add column if not exists last_seen_at timestamptz;

create table if not exists login_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists login_sessions_user_id_idx on login_sessions(user_id, started_at desc);

alter table login_sessions enable row level security;

drop policy if exists "login_sessions_select_authenticated" on login_sessions;
create policy "login_sessions_select_authenticated"
  on login_sessions for select
  to authenticated
  using (true);

create table if not exists voice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  channel_id text not null,
  joined_at timestamptz not null default now(),
  left_at timestamptz
);

create index if not exists voice_sessions_user_id_idx on voice_sessions(user_id, joined_at desc);

alter table voice_sessions enable row level security;

drop policy if exists "voice_sessions_select_authenticated" on voice_sessions;
create policy "voice_sessions_select_authenticated"
  on voice_sessions for select
  to authenticated
  using (true);

-- Called on app mount and on a heartbeat interval. A session more than 2
-- minutes stale is treated as abandoned (tab closed without a clean
-- disconnect) rather than reused, since we can't rely on unload events.
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
    insert into login_sessions (user_id) values (auth.uid());
  end if;
end;
$$;

grant execute on function touch_presence() to authenticated;

create or replace function end_my_session()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update login_sessions
  set ended_at = now()
  where user_id = auth.uid() and ended_at is null;
end;
$$;

grant execute on function end_my_session() to authenticated;

create or replace function join_voice_session(p_channel_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update voice_sessions set left_at = now() where user_id = auth.uid() and left_at is null;
  insert into voice_sessions (user_id, channel_id) values (auth.uid(), p_channel_id);
end;
$$;

grant execute on function join_voice_session(text) to authenticated;

create or replace function leave_voice_session()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update voice_sessions set left_at = now() where user_id = auth.uid() and left_at is null;
end;
$$;

grant execute on function leave_voice_session() to authenticated;
