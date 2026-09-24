-- PK system, part 5: negotiation. Everyone involved must accept the same terms
-- version; a captain can counter-propose (max pk_settings.max_counter_rounds),
-- which resets everyone else's acceptance. When all have accepted it goes to approval.

create or replace function pk_all_accepted(cid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from challenge_participants where challenge_id = cid and accepted_at is null) then return; end if;
  update challenges set status = 'awaiting_approval' where id = cid;
  perform pk_record_terms(cid, 'agreed');
  perform pk_log(cid, 'agreed', 'Everyone agreed to the terms. Waiting for approval.');
  perform pk_notify(cid, array(select pk_approver_ids(cid)),
    'A PK needs your approval: ' || (select topic from challenges where id = cid));
end;
$$;

create or replace function pk_respond(cid uuid, response text, counter jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c challenges := (select x from challenges x where x.id = cid for update);
  me challenge_participants := (select x from challenge_participants x where x.challenge_id = cid and x.user_id = auth.uid());
  s pk_settings := (select x from pk_settings x where x.id = 1);
  others uuid[] := array(select user_id from challenge_participants where challenge_id = cid);
  p jsonb;
begin
  if c.id is null or c.pk_version <> 1 then raise exception 'PK not found.'; end if;
  if me.user_id is null then raise exception 'You''re not part of this PK.'; end if;
  if c.status not in ('awaiting_opponent', 'countered') then raise exception 'This PK isn''t waiting for a response.'; end if;

  if response = 'decline' then
    update challenges set status = 'declined' where id = cid;
    perform pk_log(cid, 'declined', pk_me() || ' declined the challenge.');
    perform pk_notify(cid, others, pk_me() || ' declined your PK: ' || c.topic);
    return;
  end if;

  if me.accepted_at is not null then raise exception 'You''ve already accepted these terms.'; end if;

  if response = 'accept' then
    perform pk_check_participant(cid, uid);
    update challenge_participants set accepted_at = now() where challenge_id = cid and user_id = uid;
    perform pk_log(cid, 'accepted', pk_me() || ' accepted the terms.');
    perform pk_notify(cid, others, pk_me() || ' accepted your PK: ' || c.topic);
    perform pk_all_accepted(cid);
    return;
  end if;

  if response <> 'counter' then raise exception 'Unknown response.'; end if;
  if not me.is_captain then raise exception 'Only a team captain can counter-propose.'; end if;
  if c.counter_round >= s.max_counter_rounds then
    raise exception 'Both counter-proposals have been used. Accept or decline these terms.';
  end if;

  update challenges set
    description = coalesce(nullif(trim(counter->>'description'), ''), description),
    metric = coalesce(nullif(trim(counter->>'metric'), ''), metric),
    metric_definition = coalesce(nullif(trim(counter->>'metric_definition'), ''), metric_definition),
    direction = coalesce(counter->>'direction', direction),
    scoring = case when format = 'self_declaration' then null else coalesce(counter->>'scoring', scoring) end,
    winning_target = case when counter ? 'winning_target' then nullif(counter->>'winning_target', '')::numeric else winning_target end,
    starts_at = coalesce(nullif(counter->>'starts_at', '')::timestamptz, starts_at),
    ends_at = coalesce(nullif(counter->>'ends_at', '')::timestamptz, ends_at),
    update_frequency = coalesce(nullif(trim(counter->>'update_frequency'), ''), update_frequency),
    reward = case when counter ? 'reward' then nullif(trim(counter->>'reward'), '') else reward end,
    punishment = case when counter ? 'punishment' then nullif(trim(counter->>'punishment'), '') else punishment end,
    pk_money = coalesce(nullif(counter->>'pk_money', '')::numeric, pk_money),
    proof_method = coalesce(nullif(trim(counter->>'proof_method'), ''), proof_method),
    tiebreaker = case when counter ? 'tiebreaker' then nullif(trim(counter->>'tiebreaker'), '') else tiebreaker end,
    counter_round = counter_round + 1, terms_version = terms_version + 1, status = 'countered'
  where id = cid;
  for p in select * from jsonb_array_elements(coalesce(counter->'participants', '[]'::jsonb)) loop
    update challenge_participants
    set baseline = nullif(p->>'baseline', '')::numeric, target = nullif(p->>'target', '')::numeric
    where challenge_id = cid and user_id = (p->>'user_id')::uuid;
  end loop;
  update challenges set winning_target = (select target from challenge_participants where challenge_id = cid and side = 'A' limit 1)
  where id = cid and format = 'self_declaration';
  update challenge_participants set accepted_at = case when user_id = uid then now() end where challenge_id = cid;

  perform pk_check_terms(cid);
  perform pk_check_participant(cid, uid);
  perform pk_record_terms(cid, 'countered');
  perform pk_log(cid, 'countered', pk_me() || ' sent a counter-proposal (' || c.counter_round + 1 || ' of ' || s.max_counter_rounds || ').');
  perform pk_notify(cid, others, pk_me() || ' sent a counter-proposal on: ' || c.topic);
end;
$$;

grant execute on function pk_respond(uuid, text, jsonb) to authenticated;
