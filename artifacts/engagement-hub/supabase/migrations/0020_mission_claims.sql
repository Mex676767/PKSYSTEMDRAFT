-- Points revamp, part 4: claiming missions. Tracked missions pay out as soon
-- as the goal is met; 'manual' missions go to an admin for approval.

create or replace function claim_mission(mission_id_param uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  tz text := (select timezone from points_settings where id = 1);
  m missions := (select x from missions x where x.id = mission_id_param);
  ps date;
  ws timestamptz;
  we timestamptz;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if not coalesce((select revamp_enabled from points_settings where id = 1), false) then
    raise exception 'Missions are turned off';
  end if;
  if m.id is null or not m.active then raise exception 'Mission not available'; end if;

  ps := (select w.period_start from mission_window(m.cadence, m.starts_at, m.ends_at, tz) w);
  ws := (select w.win_start from mission_window(m.cadence, m.starts_at, m.ends_at, tz) w);
  we := (select w.win_end from mission_window(m.cadence, m.starts_at, m.ends_at, tz) w);
  if now() < ws or now() >= we then raise exception 'This mission isn''t running right now'; end if;

  if m.kind = 'manual' then
    insert into mission_claims (mission_id, user_id, period_start, status, points)
    values (m.id, uid, ps, 'pending', m.points)
    on conflict (mission_id, user_id, period_start) do update
      set status = 'pending', created_at = now(), reviewed_by = null, reviewed_at = null
      where mission_claims.status = 'rejected';
    if not found then raise exception 'Already submitted'; end if;
    return 'pending';
  end if;

  if mission_progress(uid, m.kind, ws, we, tz) < m.target_count then
    raise exception 'Not finished yet';
  end if;
  insert into mission_claims (mission_id, user_id, period_start, status, points)
  values (m.id, uid, ps, 'awarded', m.points)
  on conflict (mission_id, user_id, period_start) do nothing;
  if not found then raise exception 'Already claimed'; end if;

  perform points_ledger_add(uid, m.points, 'Mission: ' || m.title);
  insert into notifications (user_id, type, target_type, target_id, message)
  values (uid, 'points', 'rewards', m.id, 'Mission complete: ' || m.title || ' · +' || m.points || ' pts');
  return 'awarded';
end;
$$;
grant execute on function claim_mission(uuid) to authenticated;

create or replace function admin_review_mission_claim(claim_id_param uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c mission_claims := (select x from mission_claims x where x.id = claim_id_param);
  title text;
begin
  if not is_points_admin() then raise exception 'Not authorized'; end if;
  if c.id is null or c.status <> 'pending' then raise exception 'Nothing to review'; end if;
  title := coalesce((select x.title from missions x where x.id = c.mission_id), 'mission');

  update mission_claims
  set status = case when approve then 'awarded' else 'rejected' end, reviewed_by = auth.uid(), reviewed_at = now()
  where id = c.id;

  if approve then
    perform points_ledger_add(c.user_id, c.points, 'Mission: ' || title);
    insert into notifications (user_id, actor_id, type, target_type, target_id, message)
    values (c.user_id, auth.uid(), 'points', 'rewards', c.mission_id, 'Mission approved: ' || title || ' · +' || c.points || ' pts');
  else
    insert into notifications (user_id, actor_id, type, target_type, target_id, message)
    values (c.user_id, auth.uid(), 'points', 'rewards', c.mission_id, 'Mission not approved: ' || title || '. You can submit it again.');
  end if;
end;
$$;
grant execute on function admin_review_mission_claim(uuid, boolean) to authenticated;
