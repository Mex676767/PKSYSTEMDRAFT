-- PK system, part 11: starting settlement and the Winner Playbook.

-- Freeze scores and decide the winner. Winner writes a playbook next; a draw
-- goes straight to the approver (who can apply the tiebreaker).
create or replace function pk_settle_start(cid uuid, early boolean, forced_side text)
returns void language plpgsql security definer set search_path = public as $$
declare
  ws text := coalesce(forced_side, pk_winner_side(cid));
  c challenges := (select x from challenges x where x.id = cid);
begin
  update challenges set
    winner_side = ws,
    winner_id = (select user_id from challenge_participants where challenge_id = cid and side = ws order by is_captain desc limit 1),
    final_score_a = (select score from pk_side_scores(cid) where side = 'A'),
    final_score_b = (select score from pk_side_scores(cid) where side = 'B'),
    early_settlement = early,
    settlement_requested_by = auth.uid(),
    settlement_requested_at = now(),
    status = case when ws is null then 'awaiting_verification' else 'awaiting_playbook' end
  where id = cid;

  if ws is null then
    perform pk_log(cid, 'settling', 'Final scores are a draw. Waiting for the approver to confirm or apply the tiebreaker.');
    perform pk_notify(cid, array(select pk_approver_ids(cid)), 'A PK ended in a draw and needs confirming: ' || c.topic);
  else
    perform pk_log(cid, 'settling', 'Scores are locked. @' || coalesce((select username from profiles where id =
      (select winner_id from challenges where id = cid)), 'the winner') || ' wins, pending their playbook and approval.');
  end if;
  perform pk_notify(cid, array(select user_id from challenge_participants where challenge_id = cid),
    'Scores are locked on "' || c.topic || '".' || case when ws is null then ' It''s a draw.' else ' Winner: side ' || ws || '.' end);
end;
$$;

create or replace function pk_request_settlement(cid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  c challenges := (select x from challenges x where x.id = cid for update);
  me challenge_participants := (select x from challenge_participants x where x.challenge_id = cid and x.user_id = auth.uid());
begin
  if c.id is null or c.pk_version <> 1 then raise exception 'PK not found.'; end if;
  if me.user_id is null and not viewer_is_admin() then raise exception 'Only people in this PK can settle it.'; end if;
  if c.status <> 'active' then raise exception 'Only a live PK can be settled.'; end if;

  if now() >= c.ends_at then
    perform pk_settle_start(cid, false, null);
    return;
  end if;
  -- Early settlement: your side has reached the agreed winning target.
  if me.user_id is null or not pk_target_reached(cid, me.side) then
    raise exception '%', case
      when c.format = 'self_declaration' then 'You can settle early once you''ve hit 100% of your declared target. Otherwise it settles after ' || to_char(c.ends_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon') || '.'
      when c.winning_target is null then 'This PK has no winning target, so it settles after ' || to_char(c.ends_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon') || '.'
      else 'You can settle early once your side reaches the winning target (' || c.winning_target || '). Otherwise it settles after ' || to_char(c.ends_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon') || '.' end;
  end if;
  perform pk_log(cid, 'early', pk_me() || ' hit the winning target early and asked to settle.');
  perform pk_settle_start(cid, true, me.side);
end;
$$;

-- The winner (or winning captain) explains what they did. No playbook, no
-- settlement, no points.
create or replace function pk_submit_playbook(cid uuid, extra text, worked text, copy text)
returns void language plpgsql security definer set search_path = public as $$
declare
  c challenges := (select x from challenges x where x.id = cid for update);
  me challenge_participants := (select x from challenge_participants x where x.challenge_id = cid and x.user_id = auth.uid());
begin
  if c.id is null or c.pk_version <> 1 then raise exception 'PK not found.'; end if;
  if c.status <> 'awaiting_playbook' then raise exception 'This PK isn''t waiting for a playbook.'; end if;
  if me.user_id is null or me.side <> c.winner_side or (c.pk_type = 'team' and not me.is_captain) then
    raise exception 'Only the winner (the captain, for teams) writes the playbook.';
  end if;
  if length(trim(coalesce(extra, ''))) < 40 or length(trim(coalesce(worked, ''))) < 40 or length(trim(coalesce(copy, ''))) < 40 then
    raise exception 'Be specific: at least 40 characters per answer. Say what you actually did, not "worked harder".';
  end if;

  insert into pk_playbooks (challenge_id, author_id, what_extra, what_worked, how_to_copy)
  values (cid, auth.uid(), trim(extra), trim(worked), trim(copy))
  on conflict (challenge_id) do update set author_id = excluded.author_id, what_extra = excluded.what_extra,
    what_worked = excluded.what_worked, how_to_copy = excluded.how_to_copy, updated_at = now();
  update challenges set status = 'awaiting_verification' where id = cid;
  perform pk_log(cid, 'playbook', pk_me() || ' submitted the winner playbook.');
  perform pk_notify(cid, array(select pk_approver_ids(cid)), 'A PK result and playbook need your confirmation: ' || c.topic);
end;
$$;

revoke all on function pk_settle_start(uuid, boolean, text) from public, anon, authenticated;
grant execute on function pk_request_settlement(uuid), pk_submit_playbook(uuid, text, text, text) to authenticated;
