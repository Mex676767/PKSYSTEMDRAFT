-- PK system, part 6: accepting open challenges and cancelling.

-- First valid person in the department to accept becomes the opponent, on the
-- terms as posted. They give their own baseline/target if the scoring needs one.
create or replace function pk_accept_open(cid uuid, my_baseline numeric default null, my_target numeric default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c challenges := (select x from challenges x where x.id = cid for update);
begin
  if c.id is null or c.pk_version <> 1 or c.method <> 'open' then raise exception 'Open challenge not found.'; end if;
  if c.status <> 'awaiting_opponent' or c.opponent_id is not null then raise exception 'Someone has already taken this challenge.'; end if;
  if c.expires_at is not null and c.expires_at <= now() then
    update challenges set status = 'expired' where id = cid;
    raise exception 'This open challenge has expired.';
  end if;
  if uid = c.creator_id then raise exception 'You can''t accept your own challenge.'; end if;

  insert into challenge_participants (challenge_id, user_id, side, is_captain, accepted_at, baseline, target)
  values (cid, uid, 'B', true, now(), my_baseline, my_target);
  update challenges
  set opponent_id = uid,
      pk_type = case when pk_rank_of(uid) <> pk_rank_of(creator_id) then 'vs_upline' else 'one_v_one' end,
      expires_at = null
  where id = cid;

  perform pk_check_terms(cid);
  perform pk_check_participant(cid, uid);
  perform pk_check_participant(cid, c.creator_id);
  perform pk_record_terms(cid, 'accepted_open');
  perform pk_log(cid, 'accepted', pk_me() || ' took the open challenge.');
  perform pk_notify(cid, array[c.creator_id], pk_me() || ' accepted your open challenge: ' || c.topic);
  perform pk_all_accepted(cid);
end;
$$;

-- The creator (or an admin) can withdraw a PK until it's approved.
create or replace function pk_cancel(cid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  c challenges := (select x from challenges x where x.id = cid);
begin
  if c.id is null or c.pk_version <> 1 then raise exception 'PK not found.'; end if;
  if auth.uid() <> c.creator_id and not viewer_is_admin() then raise exception 'Only the person who issued it can cancel it.'; end if;
  if c.status not in ('awaiting_opponent', 'countered', 'awaiting_approval') then
    raise exception 'Only a PK that hasn''t been approved yet can be cancelled.';
  end if;
  update challenges set status = 'cancelled' where id = cid;
  perform pk_log(cid, 'cancelled', pk_me() || ' cancelled the challenge.');
  perform pk_notify(cid, array(select user_id from challenge_participants where challenge_id = cid), pk_me() || ' cancelled the PK: ' || c.topic);
end;
$$;

grant execute on function pk_accept_open(uuid, numeric, numeric), pk_cancel(uuid) to authenticated;
