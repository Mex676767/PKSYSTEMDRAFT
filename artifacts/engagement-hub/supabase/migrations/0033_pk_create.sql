-- PK system, part 4: create a PK. `terms` is JSON from the create form:
-- { method, format, team, title, description, metric, metric_definition, direction,
--   scoring, winning_target, starts_at, ends_at, update_frequency, reward, punishment,
--   pk_money, proof_method, tiebreaker, compliance_agreed,
--   creator: { baseline, target },
--   participants: [{ user_id, side, is_captain, baseline, target }] }   (everyone but the creator)
create or replace function pk_create(terms jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  dept text := (select department from profiles where id = auth.uid());
  new_id uuid := gen_random_uuid();
  fmt text := coalesce(terms->>'format', 'head_to_head');
  mth text := coalesce(terms->>'method', 'named');
  is_team boolean := coalesce((terms->>'team')::boolean, false);
  s pk_settings := (select x from pk_settings x where x.id = 1);
  p jsonb;
  opp uuid;
begin
  if uid is null then raise exception 'Sign in first.'; end if;
  if dept is null then raise exception 'Set your department on your profile before starting a PK.'; end if;
  if not coalesce((terms->>'compliance_agreed')::boolean, false) then
    raise exception 'Please agree to the fair-play rules first.';
  end if;
  if mth not in ('named', 'open') or fmt not in ('head_to_head', 'self_declaration') then raise exception 'Unknown challenge type.'; end if;
  if is_team and (mth = 'open' or fmt = 'self_declaration') then
    raise exception 'Team PKs are head-to-head named challenges for now.';
  end if;

  insert into challenges (
    id, pk_version, creator_id, topic, description, metric, metric_definition, direction, scoring, format, method,
    pk_type, department, winning_target, starts_at, ends_at, update_frequency, reward, punishment, pk_money,
    proof_method, tiebreaker, compliance_agreed, status, expires_at)
  values (
    new_id, 1, uid, trim(terms->>'title'), nullif(trim(terms->>'description'), ''), trim(terms->>'metric'),
    nullif(trim(terms->>'metric_definition'), ''), terms->>'direction',
    case when fmt = 'self_declaration' then null else terms->>'scoring' end, fmt, mth,
    case when is_team then 'team' else 'one_v_one' end, dept, nullif(terms->>'winning_target', '')::numeric,
    coalesce(nullif(terms->>'starts_at', '')::timestamptz, now()), (terms->>'ends_at')::timestamptz,
    nullif(trim(terms->>'update_frequency'), ''), nullif(trim(terms->>'reward'), ''), nullif(trim(terms->>'punishment'), ''),
    coalesce(nullif(terms->>'pk_money', '')::numeric, 0), nullif(trim(terms->>'proof_method'), ''),
    nullif(trim(terms->>'tiebreaker'), ''), true, 'awaiting_opponent',
    case when mth = 'open' then now() + make_interval(days => s.open_expiry_days) end);

  insert into challenge_participants (challenge_id, user_id, side, is_captain, accepted_at, baseline, target)
  values (new_id, uid, 'A', true, now(), nullif(terms->'creator'->>'baseline', '')::numeric, nullif(terms->'creator'->>'target', '')::numeric);

  if mth = 'named' then
    for p in select * from jsonb_array_elements(coalesce(terms->'participants', '[]'::jsonb)) loop
      if (p->>'user_id')::uuid = uid then continue; end if;
      insert into challenge_participants (challenge_id, user_id, side, is_captain, baseline, target)
      values (new_id, (p->>'user_id')::uuid, coalesce(p->>'side', 'B'), coalesce((p->>'is_captain')::boolean, not is_team),
              nullif(p->>'baseline', '')::numeric, nullif(p->>'target', '')::numeric);
    end loop;
    if is_team and (select count(*) from challenge_participants where challenge_id = new_id and side = 'B' and is_captain) <> 1 then
      raise exception 'Pick one captain for the other team.';
    end if;
    opp := (select user_id from challenge_participants where challenge_id = new_id and side = 'B'
            order by is_captain desc limit 1);
    if opp is null then raise exception 'Choose who you''re challenging.'; end if;
    if not is_team and (select count(*) from challenge_participants where challenge_id = new_id) <> 2 then
      raise exception 'A 1v1 PK has exactly one opponent.';
    end if;
  end if;

  -- A 1v1 between different ranks counts as vs Upline (docs/PK-SYSTEM.md).
  update challenges
  set opponent_id = opp,
      pk_type = case when is_team then 'team'
                     when opp is not null and pk_rank_of(opp) <> pk_rank_of(uid) then 'vs_upline'
                     else 'one_v_one' end,
      winning_target = case when fmt = 'self_declaration'
                            then (select target from challenge_participants where challenge_id = new_id and user_id = uid)
                            else winning_target end
  where id = new_id;

  perform pk_check_terms(new_id);
  perform pk_check_participant(new_id, uid);
  if exists (select 1 from challenge_participants cp join profiles pr on pr.id = cp.user_id
             where cp.challenge_id = new_id and pr.department is distinct from dept) then
    raise exception 'Everyone has to be in your department (%).', dept;
  end if;

  perform pk_record_terms(new_id, 'proposed');
  perform pk_log(new_id, 'created', pk_me() || case when mth = 'open' then ' posted an open challenge' else ' issued the challenge' end);
  perform pk_notify(new_id,
    array(select user_id from challenge_participants where challenge_id = new_id and user_id <> uid),
    pk_me() || ' challenged you to a PK: ' || trim(terms->>'title'));
  return new_id;
end;
$$;

grant execute on function pk_create(jsonb) to authenticated;
