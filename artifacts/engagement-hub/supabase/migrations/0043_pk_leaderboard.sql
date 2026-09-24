-- PK system, part 13: quarterly leaderboard and PK King / Queen.

-- One row per person with PK points in the quarter (optionally one department).
-- Streak = consecutive wins, most recent first. Rank is within the department.
create or replace function pk_leaderboard(period date default null, dept text default null)
returns table (
  user_id uuid, username text, role text, department text, avatar_url text, active_border text, active_accessory text,
  points numeric, wins integer, losses integer, draws integer, played integer, win_pct numeric, streak integer, rank integer)
language sql stable security definer set search_path = public as $$
  with pts as (
    select * from pk_points
    where period_start = coalesce(period, pk_quarter(now())) and (dept is null or department = dept)),
  ordered as (
    select user_id, outcome, row_number() over (partition by user_id order by created_at desc) as rn from pts),
  streaks as (
    select user_id, coalesce(min(rn) filter (where outcome <> 'win'), max(rn) + 1) - 1 as streak from ordered group by user_id),
  agg as (
    select p.user_id, p.department, sum(p.points) as points,
      count(*) filter (where outcome = 'win')::int as wins,
      count(*) filter (where outcome = 'loss')::int as losses,
      count(*) filter (where outcome = 'draw')::int as draws,
      count(*)::int as played
    from pts p group by p.user_id, p.department)
  select a.user_id, pr.username, pr.role, a.department, pr.avatar_url, pr.active_border, pr.active_accessory,
    a.points, a.wins, a.losses, a.draws, a.played,
    round(100.0 * a.wins / nullif(a.played, 0), 0), s.streak::int,
    rank() over (partition by a.department order by a.points desc)::int
  from agg a join profiles pr on pr.id = a.user_id join streaks s on s.user_id = a.user_id
  where coalesce(pr.is_deleted, false) = false
  order by a.department, a.points desc, a.wins desc, pr.username;
$$;

-- PK King / Queen: the top of each department for each quarter (ties share).
-- The current quarter's row is the current champion so far.
create or replace function pk_champions(dept text default null)
returns table (period_start date, department text, user_id uuid, username text, avatar_url text,
  active_border text, active_accessory text, points numeric, wins integer)
language sql stable security definer set search_path = public as $$
  with totals as (
    select p.period_start, p.department, p.user_id, sum(p.points) as points,
      count(*) filter (where p.outcome = 'win')::int as wins
    from pk_points p where dept is null or p.department = dept
    group by p.period_start, p.department, p.user_id),
  ranked as (
    select t.*, rank() over (partition by t.period_start, t.department order by t.points desc) as r from totals t)
  select r.period_start, r.department, r.user_id, pr.username, pr.avatar_url, pr.active_border, pr.active_accessory, r.points, r.wins
  from ranked r join profiles pr on pr.id = r.user_id
  where r.r = 1 and r.points > 0
  order by r.period_start desc, r.department, pr.username;
$$;

grant execute on function pk_leaderboard(date, text), pk_champions(text) to authenticated;

-- Live updates for the leaderboard and playbooks.
do $$
declare t text;
begin
  foreach t in array array['pk_points', 'pk_playbooks'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
exception when others then
  raise warning 'Realtime not enabled for PK points: %', sqlerrm;
end;
$$;
