-- PK system, part 1: challenges get PK fields; old challenges stay as pk_version 0. See docs/PK-SYSTEM.md.

alter table challenges drop constraint if exists challenges_status_check;
alter table challenges add constraint challenges_status_check check (status in (
  'pending', 'active', 'completed', 'declined',                    -- legacy + shared
  'awaiting_opponent', 'countered', 'awaiting_approval', 'rejected',
  'cancelled', 'expired', 'settlement_requested', 'awaiting_playbook',
  'awaiting_verification', 'settled', 'terminated'));

-- Open challenges have no opponent until someone accepts.
alter table challenges alter column opponent_id drop not null;
alter table challenges drop constraint if exists challenges_check;
alter table challenges add constraint challenges_check check (opponent_id is null or creator_id <> opponent_id);

alter table challenges
  add column if not exists pk_version smallint not null default 0,
  add column if not exists method text check (method in ('named', 'open')),
  add column if not exists format text check (format in ('head_to_head', 'self_declaration')),
  add column if not exists pk_type text check (pk_type in ('one_v_one', 'vs_upline', 'team')),
  add column if not exists department text,
  add column if not exists metric_definition text,
  add column if not exists direction text check (direction in ('higher', 'lower')),
  add column if not exists scoring text check (scoring in ('absolute', 'improvement', 'completion')),
  add column if not exists winning_target numeric,
  add column if not exists update_frequency text,
  add column if not exists pk_money numeric(10, 2) not null default 0 check (pk_money >= 0),
  add column if not exists proof_method text,
  add column if not exists tiebreaker text,
  add column if not exists compliance_agreed boolean not null default false,
  add column if not exists counter_round smallint not null default 0,
  add column if not exists terms_version integer not null default 1,
  add column if not exists expires_at timestamptz,
  add column if not exists approved_by uuid references profiles(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists review_note text;

create index if not exists challenges_pk_status_idx on challenges (pk_version, status);

-- Everyone in a PK: side A (creator's side) vs side B. For self-declaration,
-- side A declares and side B is the acceptor who bets against it.
create table if not exists challenge_participants (
  challenge_id uuid not null references challenges(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  side text not null check (side in ('A', 'B')),
  is_captain boolean not null default false,
  accepted_at timestamptz,
  baseline numeric,
  target numeric,
  current_value numeric,
  primary key (challenge_id, user_id)
);
create index if not exists challenge_participants_user_idx on challenge_participants (user_id);

create table if not exists challenge_terms_history (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges(id) on delete cascade,
  version integer not null,
  action text not null,
  actor_id uuid references profiles(id) on delete set null,
  terms jsonb not null,
  created_at timestamptz not null default now()
);

-- Timeline shown on the challenge page (and the audit trail).
create table if not exists challenge_events (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  kind text not null,
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists challenge_events_idx on challenge_events (challenge_id, created_at);

create table if not exists pk_settings (
  id smallint primary key default 1 check (id = 1),
  max_one_v_one smallint not null default 3,
  max_team smallint not null default 1,
  max_vs_upline smallint not null default 1,
  max_total smallint not null default 5,
  open_expiry_days smallint not null default 7,
  max_counter_rounds smallint not null default 2,
  money_limit_default numeric(10, 2) not null default 50,
  money_limit_atl_tl numeric(10, 2) not null default 100,
  money_limit_above_tl numeric(10, 2) not null default 200
);
insert into pk_settings (id) values (1) on conflict (id) do nothing;

alter table challenge_participants enable row level security;
alter table challenge_terms_history enable row level security;
alter table challenge_events enable row level security;
alter table pk_settings enable row level security;
drop policy if exists "challenge_participants_read" on challenge_participants;
create policy "challenge_participants_read" on challenge_participants for select to authenticated using (true);
drop policy if exists "challenge_terms_history_read" on challenge_terms_history;
create policy "challenge_terms_history_read" on challenge_terms_history for select to authenticated using (true);
drop policy if exists "challenge_events_read" on challenge_events;
create policy "challenge_events_read" on challenge_events for select to authenticated using (true);
drop policy if exists "pk_settings_read" on pk_settings;
create policy "pk_settings_read" on pk_settings for select to authenticated using (true);
