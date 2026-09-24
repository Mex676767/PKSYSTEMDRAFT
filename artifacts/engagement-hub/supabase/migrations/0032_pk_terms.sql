-- PK system, part 3: terms validation, terms snapshots, timeline and notifications.

create or replace function pk_check_terms(cid uuid)
returns void language plpgsql stable security definer set search_path = public as $$
declare
  c challenges := (select x from challenges x where x.id = cid);
  bad record;
  size_a integer := (select count(*) from challenge_participants where challenge_id = cid and side = 'A');
  size_b integer := (select count(*) from challenge_participants where challenge_id = cid and side = 'B');
begin
  if coalesce(trim(c.topic), '') = '' then raise exception 'Give the challenge a title.'; end if;
  if coalesce(trim(c.metric), '') = '' then raise exception 'Say what''s being measured.'; end if;
  if coalesce(trim(c.metric_definition), '') = '' then raise exception 'Explain exactly how the metric is counted.'; end if;
  if c.direction is null then raise exception 'Choose whether a higher or a lower number wins.'; end if;
  if c.format = 'head_to_head' and c.scoring is null then raise exception 'Choose how the winner is decided.'; end if;
  if coalesce(trim(c.proof_method), '') = '' then raise exception 'Say what counts as proof for score updates.'; end if;
  if c.ends_at <= c.starts_at then raise exception 'The end date has to be after the start date.'; end if;
  if c.ends_at <= now() then raise exception 'The end date has to be in the future.'; end if;
  if c.winning_target is not null and c.winning_target <= 0 then raise exception 'The winning target has to be above zero.'; end if;

  if c.format = 'self_declaration' and exists (
    select 1 from challenge_participants where challenge_id = cid and side = 'A' and (baseline is null or target is null)) then
    raise exception 'A self-declaration needs your current level and the target you''re declaring.';
  end if;
  if c.format = 'head_to_head' and c.scoring = 'improvement' and exists (
    select 1 from challenge_participants where challenge_id = cid and baseline is null) then
    raise exception 'Improvement scoring needs everyone''s starting baseline.';
  end if;
  if c.format = 'head_to_head' and c.scoring = 'completion' and exists (
    select 1 from challenge_participants where challenge_id = cid and target is null) then
    raise exception 'Completion rate scoring needs a target for everyone.';
  end if;

  -- Targets must represent improvement on the person's own baseline.
  for bad in
    select pr.username from challenge_participants p join profiles pr on pr.id = p.user_id
    where p.challenge_id = cid and p.baseline is not null and p.target is not null
      and ((c.direction = 'higher' and p.target <= p.baseline) or (c.direction = 'lower' and p.target >= p.baseline))
  loop
    raise exception 'Targets have to be an improvement: @%''s target must be % than their baseline.',
      bad.username, case when c.direction = 'higher' then 'higher' else 'lower' end;
  end loop;

  if c.pk_type = 'team' and (size_a < 2 or size_a > 5 or (size_b > 0 and size_b <> size_a)) then
    raise exception 'Team PKs need 2 to 5 people on each side, with the same number on both sides.';
  end if;
end;
$$;

-- The full terms as they stand, frozen into challenge_terms_history.
create or replace function pk_terms_snapshot(cid uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(t) || jsonb_build_object('participants', coalesce((
    select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'username', pr.username, 'side', p.side,
                                        'is_captain', p.is_captain, 'baseline', p.baseline, 'target', p.target) order by p.side, pr.username)
    from challenge_participants p join profiles pr on pr.id = p.user_id where p.challenge_id = cid), '[]'::jsonb))
  from (
    select topic as title, description, metric, metric_definition, direction, scoring, format, method, pk_type,
           department, winning_target, starts_at, ends_at, update_frequency, reward, punishment, pk_money,
           proof_method, tiebreaker, terms_version
    from challenges where id = cid
  ) t;
$$;

create or replace function pk_record_terms(cid uuid, action_name text)
returns void language sql security definer set search_path = public as $$
  insert into challenge_terms_history (challenge_id, version, action, actor_id, terms)
  select cid, terms_version, action_name, auth.uid(), pk_terms_snapshot(cid) from challenges where id = cid;
$$;

create or replace function pk_log(cid uuid, kind_name text, message_text text)
returns void language sql security definer set search_path = public as $$
  insert into challenge_events (challenge_id, actor_id, kind, message) values (cid, auth.uid(), kind_name, message_text);
$$;

-- Notify people about a PK (never the person who did it).
create or replace function pk_notify(cid uuid, user_ids uuid[], message_text text)
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, actor_id, type, target_type, target_id, message)
  select distinct u, auth.uid(), 'challenge', 'pk', cid, message_text
  from unnest(user_ids) as u where u is distinct from auth.uid();
$$;

create or replace function pk_me()
returns text language sql stable security definer set search_path = public as $$
  select coalesce('@' || (select username from profiles where id = auth.uid()), 'Someone');
$$;

revoke all on function pk_check_terms(uuid), pk_record_terms(uuid, text), pk_log(uuid, text, text), pk_notify(uuid, uuid[], text)
  from public, anon, authenticated;
