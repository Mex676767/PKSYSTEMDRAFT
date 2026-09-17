alter table profiles
  add column if not exists discord_id text unique,
  add column if not exists discord_username text;

create table if not exists discord_presence (
  user_id uuid primary key references profiles(id) on delete cascade,
  discord_id text not null,
  voice_channel_id text,
  voice_channel_name text,
  category text check (category in ('active', 'break')),
  presence_status text not null check (presence_status in ('online', 'idle', 'dnd', 'offline')),
  updated_at timestamptz not null default now()
);

alter table discord_presence enable row level security;

drop policy if exists "discord_presence_select_authenticated" on discord_presence;
create policy "discord_presence_select_authenticated"
  on discord_presence for select
  to authenticated
  using (true);
