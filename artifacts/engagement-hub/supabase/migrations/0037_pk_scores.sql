-- PK system, part 8: score updates (proof required on every one) and live scores.

create table if not exists challenge_score_updates (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  value numeric not null,
  proof_path text not null,
  comment text,
  created_at timestamptz not null default now()
);
create index if not exists challenge_score_updates_idx on challenge_score_updates (challenge_id, created_at);
alter table challenge_score_updates enable row level security;
drop policy if exists "challenge_score_updates_read" on challenge_score_updates;
create policy "challenge_score_updates_read" on challenge_score_updates for select to authenticated using (true);

-- `value` is the person's running total (not an increment), backed by a
-- screenshot/file already uploaded to post-images under their own folder.
create or replace function pk_update_score(cid uuid, new_value numeric, proof text, note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c challenges := (select x from challenges x where x.id = cid);
  me challenge_participants := (select x from challenge_participants x where x.challenge_id = cid and x.user_id = auth.uid());
begin
  if c.id is null or c.pk_version <> 1 then raise exception 'PK not found.'; end if;
  if me.user_id is null then raise exception 'Only people in this PK can update scores.'; end if;
  if c.format = 'self_declaration' and me.side <> 'A' then raise exception 'Only the person who declared can update progress.'; end if;
  if c.status <> 'active' then raise exception 'Scores can only be updated while the PK is running.'; end if;
  if now() < c.starts_at then raise exception 'This PK hasn''t started yet.'; end if;
  if new_value is null or new_value < 0 then raise exception 'Enter your current number.'; end if;
  if coalesce(trim(proof), '') = '' then raise exception 'Attach proof with every update.'; end if;
  if split_part(proof, '/', 1) <> uid::text then raise exception 'That proof file isn''t yours.'; end if;

  insert into challenge_score_updates (challenge_id, user_id, value, proof_path, comment)
  values (cid, uid, new_value, trim(proof), nullif(trim(note), ''));
  update challenge_participants set current_value = new_value where challenge_id = cid and user_id = uid;
  perform pk_log(cid, 'score', pk_me() || ' updated their score to ' || trim(to_char(new_value, 'FM999999999990.##')) || '.');
  perform pk_notify(cid, array(select user_id from challenge_participants where challenge_id = cid),
    pk_me() || ' posted a score update on: ' || c.topic);
end;
$$;

-- Live score per side. Absolute: sum of totals. Improvement: sum of gains on
-- baseline (direction-aware). Completion: % of the side's combined target.
-- Self-declaration: side A's % of the way from baseline to the declared target.
create or replace function pk_side_scores(cid uuid)
returns table (side text, score numeric) language sql stable security definer set search_path = public as $$
  with c as (select * from challenges where id = cid),
  p as (
    select cp.side, cp.baseline, cp.target, coalesce(cp.current_value, cp.baseline, 0) as cur, c.*
    from challenge_participants cp cross join c where cp.challenge_id = cid)
  select p.side, round(case
    when max(p.format) = 'self_declaration' then
      100 * sum(case when p.direction = 'lower' then p.baseline - p.cur else p.cur - p.baseline end)
          / nullif(sum(abs(p.target - p.baseline)), 0)
    when max(p.scoring) = 'absolute' then sum(p.cur)
    when max(p.scoring) = 'improvement' then
      sum(case when p.direction = 'lower' then p.baseline - p.cur else p.cur - p.baseline end)
    when max(p.direction) = 'lower' then 100 * sum(p.target) / nullif(sum(p.cur), 0)
    else 100 * sum(p.cur) / nullif(sum(p.target), 0)
  end, 2)
  from p
  where p.format <> 'self_declaration' or p.side = 'A'
  group by p.side
  order by p.side;
$$;

grant execute on function pk_update_score(uuid, numeric, text, text), pk_side_scores(uuid) to authenticated;
