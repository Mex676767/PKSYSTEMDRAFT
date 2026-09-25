-- PK system, part 17: department announcements when a PK goes live or
-- settles, and admin controls for PK settings and violations.

create or replace function pk_side_names(cid uuid, side_param text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(string_agg('@' || coalesce(pr.username, 'someone'), ', ' order by p.is_captain desc, pr.username), 'someone')
  from challenge_participants p join profiles pr on pr.id = p.user_id
  where p.challenge_id = cid and p.side = side_param;
$$;

create or replace function pk_announce()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s pk_settings := (select x from pk_settings x where x.id = 1);
  msg text;
begin
  if new.pk_version <> 1 or new.status = old.status then return new; end if;
  if new.status = 'active' and old.status = 'awaiting_approval' and s.announce_live then
    msg := '⚔️ New PK: ' || pk_side_names(new.id, 'A') ||
      case when new.format = 'self_declaration' then ' declared "' || new.topic || '"'
           else ' vs ' || pk_side_names(new.id, 'B') || ': ' || new.topic end;
  elsif new.status = 'settled' and s.announce_winner then
    msg := case when new.winner_side is null then '🤝 ' || pk_side_names(new.id, 'A') || ' and ' || pk_side_names(new.id, 'B') || ' drew "' || new.topic || '"'
      else '🏆 ' || pk_side_names(new.id, new.winner_side) || ' won "' || new.topic || '" against ' ||
        pk_side_names(new.id, case when new.winner_side = 'A' then 'B' else 'A' end) end;
  else
    return new;
  end if;
  -- Everyone else in the department; participants already get their own notices.
  insert into notifications (user_id, actor_id, type, target_type, target_id, message)
  select pr.id, auth.uid(), 'challenge', 'pk', new.id, msg
  from profiles pr
  where pr.department = new.department and coalesce(pr.is_deleted, false) = false
    and pr.id is distinct from auth.uid()
    and not exists (select 1 from challenge_participants p where p.challenge_id = new.id and p.user_id = pr.id);
  return new;
end;
$$;
drop trigger if exists challenges_pk_announce on challenges;
create trigger challenges_pk_announce after update on challenges for each row execute function pk_announce();

-- Admin: change PK settings. Only the keys given are changed.
create or replace function pk_update_settings(changes jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  k text;
  ints text[] := array['max_one_v_one', 'max_team', 'max_vs_upline', 'max_total', 'open_expiry_days', 'max_counter_rounds'];
  money text[] := array['money_limit_default', 'money_limit_atl_tl', 'money_limit_above_tl'];
  flags text[] := array['reminders_enabled', 'announce_live', 'announce_winner'];
begin
  if not viewer_is_admin() then raise exception 'Only admins can change PK settings.'; end if;
  for k in select jsonb_object_keys(changes) loop
    if k = any(ints) then
      if (changes->>k)::int < 0 or (changes->>k)::int > 100 then raise exception '% must be between 0 and 100.', k; end if;
      execute format('update pk_settings set %I = $1 where id = 1', k) using (changes->>k)::smallint;
    elsif k = any(money) then
      if (changes->>k)::numeric < 0 then raise exception 'PK Money limits can''t be negative.'; end if;
      execute format('update pk_settings set %I = $1 where id = 1', k) using (changes->>k)::numeric;
    elsif k = any(flags) then
      execute format('update pk_settings set %I = $1 where id = 1', k) using (changes->>k)::boolean;
    else
      raise exception 'Unknown setting: %', k;
    end if;
  end loop;
  if (select max_total < greatest(max_one_v_one, max_team, max_vs_upline) from pk_settings where id = 1) then
    raise exception 'The total limit can''t be lower than any single type''s limit.';
  end if;
end;
$$;

-- Admin: close a violation with a note (e.g. "spoke to them", "excused: on leave").
create or replace function pk_resolve_violation(violation_id uuid, resolution_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not viewer_is_admin() then raise exception 'Only admins can resolve violations.'; end if;
  if coalesce(trim(resolution_note), '') = '' then raise exception 'Add a note saying how it was resolved.'; end if;
  update pk_violations set resolved_at = now(), resolved_by = auth.uid(), resolution = trim(resolution_note)
  where id = violation_id and resolved_at is null;
  if not found then raise exception 'That violation is already resolved.'; end if;
end;
$$;

grant execute on function pk_update_settings(jsonb), pk_resolve_violation(uuid, text) to authenticated;
