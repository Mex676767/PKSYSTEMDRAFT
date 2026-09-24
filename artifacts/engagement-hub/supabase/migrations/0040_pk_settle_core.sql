-- PK system, part 10: settlement data. Winner, frozen final scores, the
-- Winner Playbook and the PK points ledger (separate from reward points).

alter table challenges
  add column if not exists winner_side text check (winner_side in ('A', 'B')),
  add column if not exists final_score_a numeric,
  add column if not exists final_score_b numeric,
  add column if not exists early_settlement boolean not null default false,
  add column if not exists settlement_requested_by uuid references profiles(id) on delete set null,
  add column if not exists settlement_requested_at timestamptz,
  add column if not exists settled_by uuid references profiles(id) on delete set null,
  add column if not exists settled_at timestamptz;

create table if not exists pk_playbooks (
  challenge_id uuid primary key references challenges(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  what_extra text not null,
  what_worked text not null,
  how_to_copy text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Leaderboard points: win +3.5, loss -0.5, draw +0.5, per calendar quarter.
create table if not exists pk_points (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  challenge_id uuid not null references challenges(id) on delete cascade,
  points numeric(5, 1) not null,
  outcome text not null check (outcome in ('win', 'loss', 'draw')),
  department text,
  period_start date not null,
  created_at timestamptz not null default now(),
  unique (user_id, challenge_id)
);
create index if not exists pk_points_period_idx on pk_points (period_start, department);

alter table pk_playbooks enable row level security;
alter table pk_points enable row level security;
drop policy if exists "pk_playbooks_read" on pk_playbooks;
create policy "pk_playbooks_read" on pk_playbooks for select to authenticated using (true);
drop policy if exists "pk_points_read" on pk_points;
create policy "pk_points_read" on pk_points for select to authenticated using (true);

-- Calendar quarter a moment falls in (company time).
create or replace function pk_quarter(ts timestamptz)
returns date language sql immutable set search_path = public as $$
  select date_trunc('quarter', ts at time zone 'Asia/Kuala_Lumpur')::date;
$$;

-- Who's ahead right now: 'A', 'B', or null for a draw. Self-declaration:
-- the declarer wins at 100% of their declared target, otherwise side B.
create or replace function pk_winner_side(cid uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  c challenges := (select x from challenges x where x.id = cid);
  a numeric := coalesce((select score from pk_side_scores(cid) where side = 'A'), 0);
  b numeric := coalesce((select score from pk_side_scores(cid) where side = 'B'), 0);
begin
  if c.format = 'self_declaration' then return case when a >= 100 then 'A' else 'B' end; end if;
  if a = b then return null; end if;
  if c.scoring = 'absolute' and c.direction = 'lower' then return case when a < b then 'A' else 'B' end; end if;
  return case when a > b then 'A' else 'B' end;
end;
$$;

-- Has this side hit the winning target (for early settlement)? Needs at
-- least one real score update from that side.
create or replace function pk_target_reached(cid uuid, side_param text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  c challenges := (select x from challenges x where x.id = cid);
  s numeric := (select score from pk_side_scores(cid) where side = side_param);
begin
  if s is null or not exists (
    select 1 from challenge_score_updates u join challenge_participants p on p.challenge_id = u.challenge_id and p.user_id = u.user_id
    where u.challenge_id = cid and p.side = side_param) then
    return false;
  end if;
  if c.format = 'self_declaration' then return side_param = 'A' and s >= 100; end if;
  if c.winning_target is null then return false; end if;
  if c.scoring = 'absolute' and c.direction = 'lower' then return s <= c.winning_target; end if;
  return s >= c.winning_target;
end;
$$;

grant execute on function pk_winner_side(uuid), pk_target_reached(uuid, text), pk_quarter(timestamptz) to authenticated;
