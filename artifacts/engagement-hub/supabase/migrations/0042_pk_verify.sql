-- PK system, part 12: the approver confirms the result, playbook and that the
-- reward/penalty happened. Then PK points are given and the PK is settled.
-- decision: 'confirm' | 'playbook' (send the playbook back) | 'reopen' (scores were wrong)
create or replace function pk_verify(cid uuid, decision text, note text default null, tiebreak_side text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  c challenges := (select x from challenges x where x.id = cid for update);
  everyone uuid[] := array(select user_id from challenge_participants where challenge_id = cid);
  msg text := nullif(trim(coalesce(note, '')), '');
begin
  if c.id is null or c.pk_version <> 1 then raise exception 'PK not found.'; end if;
  if c.status <> 'awaiting_verification' then raise exception 'This PK isn''t waiting for confirmation.'; end if;
  if not pk_can_approve(cid, auth.uid()) then raise exception 'You can''t confirm this PK.'; end if;
  if decision in ('playbook', 'reopen') and msg is null then raise exception 'Add a note saying what needs fixing.'; end if;

  if decision = 'reopen' then
    update challenges set status = 'active', winner_side = null, winner_id = null, final_score_a = null, final_score_b = null,
      early_settlement = false, settlement_requested_by = null, settlement_requested_at = null where id = cid;
    delete from pk_playbooks where challenge_id = cid;
    perform pk_log(cid, 'reopened', pk_me() || ' reopened the PK to fix the scores: ' || msg);
    perform pk_notify(cid, everyone, 'Your PK "' || c.topic || '" was reopened: ' || msg);
    return;
  end if;

  if decision = 'playbook' then
    if c.winner_side is null then raise exception 'A draw has no playbook to send back.'; end if;
    update challenges set status = 'awaiting_playbook', review_note = msg where id = cid;
    perform pk_log(cid, 'playbook_returned', pk_me() || ' sent the playbook back: ' || msg);
    perform pk_notify(cid, array[c.winner_id], 'Your playbook for "' || c.topic || '" needs more detail: ' || msg);
    return;
  end if;

  if decision <> 'confirm' then raise exception 'Unknown decision.'; end if;

  -- A draw can be decided by the agreed tiebreaker; the winner then writes a playbook.
  if c.winner_side is null and tiebreak_side in ('A', 'B') then
    update challenges set winner_side = tiebreak_side, status = 'awaiting_playbook',
      winner_id = (select user_id from challenge_participants where challenge_id = cid and side = tiebreak_side order by is_captain desc limit 1)
    where id = cid;
    perform pk_log(cid, 'tiebreak', pk_me() || ' applied the tiebreaker: side ' || tiebreak_side || ' wins' || coalesce(' (' || msg || ')', '') || '.');
    perform pk_notify(cid, everyone, 'Tiebreaker applied on "' || c.topic || '". Side ' || tiebreak_side || ' wins.');
    return;
  end if;
  if c.winner_side is not null and not exists (select 1 from pk_playbooks where challenge_id = cid) then
    raise exception 'The winner hasn''t written a playbook yet.';
  end if;

  insert into pk_points (user_id, challenge_id, points, outcome, department, period_start)
  select p.user_id, cid,
    case when c.winner_side is null then 0.5 when p.side = c.winner_side then 3.5 else -0.5 end,
    case when c.winner_side is null then 'draw' when p.side = c.winner_side then 'win' else 'loss' end,
    c.department, pk_quarter(now())
  from challenge_participants p where p.challenge_id = cid
  on conflict (user_id, challenge_id) do nothing;

  update challenges set status = 'settled', settled_by = auth.uid(), settled_at = now(), review_note = coalesce(msg, review_note)
  where id = cid;
  perform pk_log(cid, 'settled', pk_me() || ' confirmed the result. PK points are in.' || coalesce(' Note: ' || msg, ''));
  perform pk_notify(cid, everyone, '"' || c.topic || '" is settled. ' ||
    case when c.winner_side is null then 'It''s a draw, +0.5 PK points each.' else 'Winners +3.5 PK points, the other side -0.5.' end);
end;
$$;

-- Approvals and confirmations waiting on the signed-in person.
create or replace function pk_pending_approvals()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from challenges
  where pk_version = 1 and status in ('awaiting_approval', 'awaiting_verification') and pk_can_approve(id, auth.uid());
$$;

-- PKs that ended 2+ days ago and nobody settled get their scores locked.
create or replace function pk_auto_settle()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
begin
  for r in select id from challenges where pk_version = 1 and status = 'active' and ends_at < now() - interval '2 days' loop
    perform pk_settle_start(r.id, false, null);
    n := n + 1;
  end loop;
  return n;
end;
$$;

grant execute on function pk_verify(uuid, text, text, text) to authenticated;
revoke all on function pk_auto_settle() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'pk-auto-settle') then perform cron.unschedule('pk-auto-settle'); end if;
  perform cron.schedule('pk-auto-settle', '40 * * * *', 'select pk_auto_settle()');
exception when others then
  raise warning 'pg_cron unavailable, ended PKs won''t lock automatically: %', sqlerrm;
end;
$$;
