-- Points revamp, part 1: settings, missions, rewards and their claims.
-- Everything here is inert until an admin switches the revamp on; with it off
-- only the existing points system (daily login bonus, gifts, etc.) runs.

create table if not exists points_settings (
  id smallint primary key default 1 check (id = 1),
  revamp_enabled boolean not null default false,
  timezone text not null default 'Asia/Kuala_Lumpur',
  updated_at timestamptz not null default now()
);
insert into points_settings (id) values (1) on conflict (id) do nothing;

create or replace function is_points_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and is_admin = true);
$$;

create table if not exists missions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text,
  cadence text not null check (cadence in ('daily', 'weekly', 'monthly', 'special')),
  kind text not null,
  target_count integer not null default 1 check (target_count > 0),
  points integer not null check (points > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists mission_claims (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  period_start date not null,
  status text not null check (status in ('awarded', 'pending', 'rejected')),
  points integer not null,
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (mission_id, user_id, period_start)
);

create table if not exists rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text,
  cost integer not null check (cost > 0),
  stock integer check (stock is null or stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid references rewards(id) on delete set null,
  reward_name text not null,
  user_id uuid not null references profiles(id) on delete cascade,
  cost integer not null,
  status text not null default 'pending' check (status in ('pending', 'fulfilled', 'rejected')),
  admin_note text,
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table points_settings enable row level security;
alter table missions enable row level security;
alter table mission_claims enable row level security;
alter table rewards enable row level security;
alter table reward_redemptions enable row level security;

drop policy if exists "points_settings_read" on points_settings;
create policy "points_settings_read" on points_settings for select to authenticated using (true);
drop policy if exists "points_settings_admin" on points_settings;
create policy "points_settings_admin" on points_settings for update to authenticated using (is_points_admin()) with check (is_points_admin());

-- Missions and rewards: everyone reads, admins manage. Claims and
-- redemptions: people see their own, admins see all; writes go via functions.
drop policy if exists "missions_read" on missions;
create policy "missions_read" on missions for select to authenticated using (true);
drop policy if exists "missions_admin" on missions;
create policy "missions_admin" on missions for all to authenticated using (is_points_admin()) with check (is_points_admin());
drop policy if exists "rewards_read" on rewards;
create policy "rewards_read" on rewards for select to authenticated using (true);
drop policy if exists "rewards_admin" on rewards;
create policy "rewards_admin" on rewards for all to authenticated using (is_points_admin()) with check (is_points_admin());
drop policy if exists "mission_claims_read" on mission_claims;
create policy "mission_claims_read" on mission_claims for select to authenticated using (user_id = auth.uid() or is_points_admin());
drop policy if exists "reward_redemptions_read" on reward_redemptions;
create policy "reward_redemptions_read" on reward_redemptions for select to authenticated using (user_id = auth.uid() or is_points_admin());
