-- PK system, part 2: shared rules used by create / counter / accept / approve.
-- Role rank: 1 = most senior (org_roles). No role counts as most junior.

create or replace function pk_rank_of(user_id_param uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce((select r.rank from profiles p join org_roles r on r.name = p.role where p.id = user_id_param), 1000);
$$;

create or replace function pk_role_rank(role_name text)
returns integer language sql stable security definer set search_path = public as $$
  select rank from org_roles where name = role_name;
$$;

-- Monthly PK Money allowance: above TL 200, ATL/TL 100, everyone else 50 (pk_settings).
create or replace function pk_money_limit(user_id_param uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select case
    when pk_role_rank('TL') is not null and pk_rank_of(user_id_param) < pk_role_rank('TL') then s.money_limit_above_tl
    when pk_rank_of(user_id_param) between least(pk_role_rank('TL'), pk_role_rank('ATL')) and greatest(pk_role_rank('TL'), pk_role_rank('ATL')) then s.money_limit_atl_tl
    else s.money_limit_default end
  from pk_settings s where s.id = 1;
$$;

-- Stakes already committed in a month (by start date, company time).
create or replace function pk_money_used(user_id_param uuid, month_start date, exclude_id uuid default null)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(c.pk_money), 0)
  from challenges c join challenge_participants p on p.challenge_id = c.id
  where p.user_id = user_id_param and c.pk_version = 1 and c.id is distinct from exclude_id
    and c.status in ('awaiting_approval', 'active', 'settlement_requested', 'awaiting_playbook', 'awaiting_verification', 'settled')
    and date_trunc('month', c.starts_at at time zone 'Asia/Kuala_Lumpur')::date = month_start;
$$;

-- One participant's eligibility: department, active-PK limits, PK Money.
create or replace function pk_check_participant(cid uuid, user_id_param uuid)
returns void language plpgsql stable security definer set search_path = public as $$
declare
  c challenges := (select x from challenges x where x.id = cid);
  s pk_settings := (select x from pk_settings x where x.id = 1);
  who text := coalesce('@' || (select username from profiles where id = user_id_param), 'Someone');
  live text[] := array['awaiting_approval', 'active', 'settlement_requested', 'awaiting_playbook', 'awaiting_verification'];
  total integer;
  same_type integer;
  used numeric;
  allowance numeric := pk_money_limit(user_id_param);
begin
  if (select department from profiles where id = user_id_param) is distinct from c.department then
    raise exception '% isn''t in %. PKs are within one department for now.', who, c.department;
  end if;
  total := (select count(*) from challenges x join challenge_participants p on p.challenge_id = x.id
            where p.user_id = user_id_param and x.pk_version = 1 and x.status = any(live) and x.id <> cid);
  same_type := (select count(*) from challenges x join challenge_participants p on p.challenge_id = x.id
                where p.user_id = user_id_param and x.pk_version = 1 and x.status = any(live) and x.id <> cid and x.pk_type = c.pk_type);
  if total >= s.max_total then
    raise exception '% already has % PKs going (the most is %).', who, total, s.max_total;
  end if;
  if (c.pk_type = 'one_v_one' and same_type >= s.max_one_v_one) or (c.pk_type = 'team' and same_type >= s.max_team)
     or (c.pk_type = 'vs_upline' and same_type >= s.max_vs_upline) then
    raise exception '% already has the most % PKs allowed at once (%).', who,
      case c.pk_type when 'one_v_one' then '1v1' when 'team' then 'team' else 'vs Upline' end,
      case c.pk_type when 'one_v_one' then s.max_one_v_one when 'team' then s.max_team else s.max_vs_upline end;
  end if;
  used := pk_money_used(user_id_param, date_trunc('month', c.starts_at at time zone 'Asia/Kuala_Lumpur')::date, cid);
  if c.pk_money > 0 and used + c.pk_money > allowance then
    raise exception 'USD % is over %''s PK Money allowance for that month (USD % of % used).', c.pk_money, who, used, allowance;
  end if;
end;
$$;

-- Who may approve: an admin, or someone in the same department (not playing)
-- at least one level above the most senior participant and at least ATL.
create or replace function pk_can_approve(cid uuid, user_id_param uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from profiles where id = user_id_param and is_admin) then true
    when exists (select 1 from challenge_participants where challenge_id = cid and user_id = user_id_param) then false
    else coalesce((
      select pr.department = c.department and coalesce(pr.is_deleted, false) = false
             and pk_rank_of(user_id_param) <= least(m.top - 1, coalesce(pk_role_rank('ATL'), m.top - 1))
      from challenges c
      cross join (select min(pk_rank_of(user_id)) as top from challenge_participants where challenge_id = cid) m
      join profiles pr on pr.id = user_id_param
      where c.id = cid), false)
  end;
$$;

-- People to ask for approval: eligible non-admins, or admins if nobody fits.
create or replace function pk_approver_ids(cid uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  with eligible as (
    select p.id from profiles p
    where not p.is_admin and coalesce(p.is_deleted, false) = false and pk_can_approve(cid, p.id))
  select id from eligible
  union all
  select p.id from profiles p where p.is_admin and coalesce(p.is_deleted, false) = false and not exists (select 1 from eligible);
$$;

revoke all on function pk_check_participant(uuid, uuid) from public, anon, authenticated;
grant execute on function pk_can_approve(uuid, uuid), pk_money_limit(uuid), pk_money_used(uuid, date, uuid) to authenticated;
