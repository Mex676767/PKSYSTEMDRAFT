-- PK System rules v3.42 / v3.43.
-- Existing Phase 1 matches keep rules_version v3.41 and their original scoring.

alter table challenges add column if not exists rules_version text;
update challenges set rules_version = case when pk_version = 1 then 'v3.41' else 'legacy' end where rules_version is null;
alter table challenges alter column rules_version set default 'v3.43';
alter table challenges alter column rules_version set not null;

alter table challenges drop constraint if exists challenges_pk_type_check;
alter table challenges add constraint challenges_pk_type_check
  check (pk_type in ('one_v_one', 'vs_upline', 'team', 'department'));

alter table challenges
  add column if not exists base_tier smallint,
  add column if not exists tier_reason text,
  add column if not exists upgrade_tier smallint,
  add column if not exists upgrade_requirement text,
  add column if not exists upgrade_evidence text,
  add column if not exists upgrade_completed boolean not null default false,
  add column if not exists effective_tier smallint,
  add column if not exists tier_approved_by uuid references profiles(id) on delete set null,
  add column if not exists tier_approved_at timestamptz,
  add column if not exists tier_disputed_by uuid references profiles(id) on delete set null,
  add column if not exists tier_disputed_at timestamptz,
  add column if not exists tier_dispute_note text,
  add column if not exists stake_kind text,
  add column if not exists point_stake numeric(6,2) not null default 0,
  add column if not exists is_revenge boolean not null default false,
  add column if not exists revenge_user_id uuid references profiles(id) on delete set null,
  add column if not exists opponent_department text,
  add column if not exists settled_month date,
  add column if not exists scoring_breakdown jsonb;

alter table challenges drop constraint if exists challenges_base_tier_check;
alter table challenges add constraint challenges_base_tier_check check (base_tier is null or base_tier in (5, 8, 10));
alter table challenges drop constraint if exists challenges_upgrade_tier_check;
alter table challenges add constraint challenges_upgrade_tier_check check (upgrade_tier is null or upgrade_tier in (8, 10));
alter table challenges drop constraint if exists challenges_effective_tier_check;
alter table challenges add constraint challenges_effective_tier_check check (effective_tier is null or effective_tier in (5, 8, 10));
alter table challenges drop constraint if exists challenges_stake_kind_check;
alter table challenges add constraint challenges_stake_kind_check
  check (stake_kind is null or stake_kind in ('honour', 'title', 'task', 'privilege', 'pk_points'));
alter table challenges drop constraint if exists challenges_point_stake_check;
alter table challenges add constraint challenges_point_stake_check check (point_stake between 0 and 3);

alter table challenge_participants
  add column if not exists completed_properly boolean not null default true,
  add column if not exists stopped_updates_at timestamptz,
  add column if not exists stopped_updates_note text;
alter table pk_violations
  add column if not exists required_update text,
  add column if not exists consequence text,
  add column if not exists monthly_count integer,
  add column if not exists ban_start timestamptz,
  add column if not exists ban_end timestamptz;

alter table pk_points alter column points type numeric(10,2);
alter table pk_settings
  add column if not exists bonus_stacking text not null default 'additive',
  add column if not exists prize_pic text not null default 'Ken',
  add column if not exists prize_amount text not null default 'TBA',
  add column if not exists penalty_pic text not null default 'Ken',
  add column if not exists penalty_notice text not null default 'Announced in advance';

alter table pk_settings drop constraint if exists pk_settings_bonus_stacking_check;
alter table pk_settings add constraint pk_settings_bonus_stacking_check check (bonus_stacking in ('additive', 'multiplicative'));

create table if not exists pk_approval_requirements (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges(id) on delete cascade,
  department text,
  requirement text not null check (requirement in ('superior', 'hod')),
  approved_by uuid references profiles(id) on delete set null,
  approved_at timestamptz,
  note text,
  unique (challenge_id, department, requirement)
);

create table if not exists pk_point_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  challenge_id uuid references challenges(id) on delete set null,
  points numeric(10,2) not null,
  kind text not null check (kind in ('match', 'stake', 'adjustment')),
  code text not null,
  period_start date not null,
  rules_version text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists pk_point_ledger_match_once
  on pk_point_ledger(user_id, challenge_id, kind) where kind = 'match';
create index if not exists pk_point_ledger_month_idx on pk_point_ledger(period_start, user_id);

create table if not exists pk_streaks (
  user_id uuid primary key references profiles(id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists pk_monthly_bans (
  user_id uuid not null references profiles(id) on delete cascade,
  month_start date not null,
  reason text not null,
  ban_start timestamptz not null default now(),
  ban_end timestamptz not null default (now()+interval '1 month'),
  created_at timestamptz not null default now(),
  primary key (user_id, month_start)
);

create table if not exists pk_ranking_groups (
  department text primary key,
  ranking_group text not null
);
create table if not exists pk_monthly_seasons (
  month_start date not null,
  ranking_group text not null,
  prize_pic text not null default 'Ken',
  prize_amount text not null default 'TBA',
  prize_status text not null default 'pending',
  penalty_pic text not null default 'Ken',
  announced_penalty text,
  archived_at timestamptz,
  final_ranking jsonb,
  primary key(month_start,ranking_group)
);
insert into pk_ranking_groups(department, ranking_group)
select name,
  case
    when upper(name) like '%MARKET%' or upper(name) like '%RETENTION%' or upper(name) like 'RTN%'
      or upper(name) like '%DESIGN%' then 'Marketing + Retention + Designer'
    else name
  end
from org_departments
on conflict (department) do nothing;

alter table pk_approval_requirements enable row level security;
alter table pk_point_ledger enable row level security;
alter table pk_streaks enable row level security;
alter table pk_monthly_bans enable row level security;
alter table pk_ranking_groups enable row level security;
alter table pk_monthly_seasons enable row level security;
drop policy if exists "pk_approval_requirements_read" on pk_approval_requirements;
create policy "pk_approval_requirements_read" on pk_approval_requirements for select to authenticated using (true);
drop policy if exists "pk_point_ledger_read" on pk_point_ledger;
create policy "pk_point_ledger_read" on pk_point_ledger for select to authenticated using (true);
drop policy if exists "pk_streaks_read" on pk_streaks;
create policy "pk_streaks_read" on pk_streaks for select to authenticated using (true);
drop policy if exists "pk_monthly_bans_read" on pk_monthly_bans;
create policy "pk_monthly_bans_read" on pk_monthly_bans for select to authenticated using (viewer_is_admin() or user_id = auth.uid());
drop policy if exists "pk_ranking_groups_read" on pk_ranking_groups;
create policy "pk_ranking_groups_read" on pk_ranking_groups for select to authenticated using (true);
drop policy if exists "pk_monthly_seasons_read" on pk_monthly_seasons;
create policy "pk_monthly_seasons_read" on pk_monthly_seasons for select to authenticated using (true);

create or replace function pk_month(ts timestamptz)
returns date language sql immutable set search_path = public as $$
  select date_trunc('month', ts at time zone 'Asia/Kuala_Lumpur')::date;
$$;

create or replace function pk_month_balance(uid uuid, month_param date default null)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(points), 0) from pk_point_ledger
  where user_id = uid and period_start = coalesce(month_param, pk_month(now()));
$$;

create or replace function pk_point_committed(uid uuid, month_param date, exclude_id uuid default null)
returns numeric language sql stable security definer set search_path=public as $$
  select coalesce(sum(c.point_stake),0) from challenges c join challenge_participants cp on cp.challenge_id=c.id
  where cp.user_id=uid and c.id is distinct from exclude_id and c.rules_version='v3.43' and c.stake_kind='pk_points'
    and pk_month(c.starts_at)=month_param and c.status in ('awaiting_opponent','countered','awaiting_approval','active','settlement_requested','awaiting_playbook','awaiting_verification');
$$;

create or replace function pk_is_banned(uid uuid, month_param date default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from pk_monthly_bans where user_id=uid and ban_start<=now() and ban_end>now());
$$;

-- v3.43 removes concurrent caps and PK Money. Department restrictions only
-- apply to non-department PKs. Point stakes are limited by this month's ledger.
create or replace function pk_check_participant(cid uuid, user_id_param uuid)
returns void language plpgsql stable security definer set search_path = public as $$
declare
  c challenges := (select x from challenges x where x.id = cid);
  who text := coalesce('@' || (select username from profiles where id = user_id_param), 'Someone');
begin
  if c.rules_version <> 'v3.43' then
    if (select department from profiles where id = user_id_param) is distinct from c.department then
      raise exception '% isn''t in %.', who, c.department;
    end if;
    return;
  end if;
  if pk_is_banned(user_id_param, pk_month(c.starts_at)) then
    raise exception '% is banned from PKs for that month after more than three violations.', who;
  end if;
  if c.pk_type <> 'department' and (select department from profiles where id = user_id_param) is distinct from c.department then
    raise exception '% isn''t in %.', who, c.department;
  end if;
  if c.point_stake > 0 and pk_month_balance(user_id_param, pk_month(c.starts_at))-pk_point_committed(user_id_param,pk_month(c.starts_at),cid) < c.point_stake then
    raise exception '% only has % PK points available that month; the stake is %.', who,
      pk_month_balance(user_id_param, pk_month(c.starts_at)), c.point_stake;
  end if;
end;
$$;

create or replace function pk_prepare_approvals(cid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c challenges := (select x from challenges x where x.id = cid);
begin
  delete from pk_approval_requirements where challenge_id = cid;
  if c.pk_type = 'department' then
    insert into pk_approval_requirements(challenge_id, department, requirement)
    select cid, d, r
    from (select distinct pr.department d from challenge_participants cp join profiles pr on pr.id=cp.user_id where cp.challenge_id=cid) x
    cross join unnest(array['superior','hod']) r;
  else
    insert into pk_approval_requirements(challenge_id, department, requirement)
    values (cid, c.department, 'superior');
  end if;
end;
$$;

create or replace function pk_can_sign_requirement(req pk_approval_requirements, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select
    coalesce(p.is_deleted,false)=false and p.department=req.department
    and not exists(select 1 from challenge_participants cp where cp.challenge_id=req.challenge_id and cp.user_id=uid)
    and case when req.requirement='hod' then p.role='HOD'
      else pk_rank_of(uid) < coalesce((select min(pk_rank_of(cp.user_id)) from challenge_participants cp join profiles pp on pp.id=cp.user_id
                                      where cp.challenge_id=req.challenge_id and pp.department=req.department),1000) end
    from profiles p where p.id=uid), false);
$$;

create or replace function pk_all_accepted(cid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from challenge_participants where challenge_id=cid and accepted_at is null) then return; end if;
  update challenges set status='awaiting_approval' where id=cid;
  if (select rules_version from challenges where id=cid)='v3.43' then perform pk_prepare_approvals(cid); end if;
  perform pk_record_terms(cid, 'agreed');
  perform pk_log(cid, 'agreed', 'Everyone agreed to the terms. Waiting for the required signers.');
  perform pk_notify(cid, array(select p.id from profiles p where exists (
    select 1 from pk_approval_requirements r where r.challenge_id=cid and r.approved_at is null and pk_can_sign_requirement(r,p.id))),
    'A PK needs your approval: ' || (select topic from challenges where id=cid));
end;
$$;

create or replace function pk_review(cid uuid, approve boolean, note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  c challenges := (select x from challenges x where x.id=cid for update);
  req pk_approval_requirements;
begin
  if c.id is null or c.pk_version<>1 then raise exception 'PK not found.'; end if;
  if c.status<>'awaiting_approval' then raise exception 'This PK isn''t waiting for approval.'; end if;
  if c.rules_version<>'v3.43' then
    if not pk_can_approve(cid,auth.uid()) then raise exception 'You can''t approve this PK.'; end if;
  else
    select r into req from pk_approval_requirements r where r.challenge_id=cid and r.approved_at is null
      and pk_can_sign_requirement(r,auth.uid()) order by case when r.requirement='superior' then 0 else 1 end limit 1;
    if req.id is null then raise exception 'You are not one of the remaining required signers.'; end if;
  end if;
  if not approve then
    if coalesce(trim(note),'')='' then raise exception 'Say why you are rejecting it.'; end if;
    update challenges set status='rejected',review_note=trim(note),approved_by=auth.uid(),approved_at=now() where id=cid;
    perform pk_log(cid,'rejected',pk_me() || ' rejected the PK: ' || trim(note));
    perform pk_notify(cid,array(select user_id from challenge_participants where challenge_id=cid),'Your PK "' || c.topic || '" was not approved: ' || trim(note));
    return;
  end if;
  perform pk_check_terms(cid);
  if c.rules_version='v3.43' then
    update pk_approval_requirements set approved_by=auth.uid(),approved_at=now(),note=nullif(trim(note),'') where id=req.id;
    perform pk_log(cid,'signed',pk_me() || ' signed as ' || req.requirement || ' for ' || req.department || '.');
    if exists(select 1 from pk_approval_requirements where challenge_id=cid and approved_at is null) then return; end if;
  end if;
  update challenges set status='active',review_note=nullif(trim(note),''),approved_by=auth.uid(),approved_at=now(),
    tier_approved_by=auth.uid(),tier_approved_at=now(),effective_tier=base_tier where id=cid;
  perform pk_record_terms(cid,'approved');
  perform pk_log(cid,'approved','All required signers approved the PK. It is live.');
  perform pk_notify(cid,array(select user_id from challenge_participants where challenge_id=cid),'Your PK "' || c.topic || '" was approved. It is live.');
end;
$$;

create or replace function pk_pending_approvals()
returns setof uuid language sql stable security definer set search_path = public as $$
  select c.id from challenges c where c.pk_version=1 and c.status in ('awaiting_approval','awaiting_verification') and
    case when c.status='awaiting_verification' then pk_can_approve(c.id,auth.uid())
      when c.rules_version='v3.43' then exists(select 1 from pk_approval_requirements r where r.challenge_id=c.id and r.approved_at is null and pk_can_sign_requirement(r,auth.uid()))
      else pk_can_approve(c.id,auth.uid()) end;
$$;

create or replace function pk_current_streak(uid uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce((select current_streak from pk_streaks where user_id=uid),0);
$$;

create or replace function pk_record_violation(cid uuid, uid uuid, kind_name text, message_text text)
returns void language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  select count(*)+1 into n from pk_violations where user_id=uid and kind='stopped_updates' and created_at>=pk_month(now()) and created_at<pk_month(now())+interval '1 month';
  insert into pk_violations(challenge_id,user_id,kind,note,required_update,consequence,monthly_count)
  select cid,uid,kind_name,message_text,c.update_frequency,'Loss; no completed-loss point; monthly stoppage violation',n from challenges c where c.id=cid;
  if n>3 then
    insert into pk_monthly_bans(user_id,month_start,reason,ban_start,ban_end) values(uid,pk_month(now()),'More than three update-stoppage violations this month',now(),now()+interval '1 month') on conflict do nothing;
    update pk_violations set ban_start=now(),ban_end=now()+interval '1 month',consequence=consequence || '; one-month PK ban' where challenge_id=cid and user_id=uid and kind=kind_name and created_at=(select max(created_at) from pk_violations where challenge_id=cid and user_id=uid and kind=kind_name);
  end if;
end;
$$;

create or replace function pk_mark_stopped(cid uuid, participant_id uuid, note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid()<>participant_id and not viewer_is_admin() and not pk_can_approve(cid,auth.uid()) then raise exception 'Not allowed.'; end if;
  if not exists(select 1 from challenges where id=cid and status='active' and rules_version='v3.43') then raise exception 'This PK is not live.'; end if;
  update challenge_participants set completed_properly=false,stopped_updates_at=now(),stopped_updates_note=nullif(trim(note),'')
  where challenge_id=cid and user_id=participant_id and stopped_updates_at is null;
  if not found then raise exception 'That participant was already marked as stopped.'; end if;
  perform pk_record_violation(cid,participant_id,'stopped_updates',coalesce(nullif(trim(note),''),'Stopped providing agreed score updates.'));
  perform pk_log(cid,'stopped_updates','A participant stopped providing agreed score updates; the loss completion point is forfeited.');
end;
$$;

create or replace function pk_winner_side(cid uuid)
returns text language plpgsql stable security definer set search_path=public as $$
declare c challenges:=(select x from challenges x where x.id=cid); a numeric:=coalesce((select score from pk_side_scores(cid) where side='A'),0); b numeric:=coalesce((select score from pk_side_scores(cid) where side='B'),0); stopped_a boolean; stopped_b boolean;
begin
  if c.rules_version='v3.43' then
    select exists(select 1 from challenge_participants where challenge_id=cid and side='A' and stopped_updates_at is not null),exists(select 1 from challenge_participants where challenge_id=cid and side='B' and stopped_updates_at is not null) into stopped_a,stopped_b;
    if stopped_a and not stopped_b then return 'B'; end if;
    if stopped_b and not stopped_a then return 'A'; end if;
  end if;
  if c.format='self_declaration' then return case when a>=100 then 'A' else 'B' end; end if;
  if a=b then return null; end if;
  if c.scoring='absolute' and c.direction='lower' then return case when a<b then 'A' else 'B' end; end if;
  return case when a>b then 'A' else 'B' end;
end;
$$;

-- Central v3.43 settlement engine. Bonus stacking is explicit in pk_settings:
-- additive means tier * (1 + streak% + bounty%); multiplicative compounds them.
create or replace function pk_award_v343(cid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  c challenges := (select x from challenges x where x.id=cid for update);
  p record; opp_streak integer; before_streak integer; after_streak integer;
  tier numeric; streak_pct numeric; bounty_pct numeric; awarded numeric; month_date date:=pk_month(now());
  stack_mode text := (select bonus_stacking from pk_settings where id=1); before_map jsonb;
begin
  if c.rules_version<>'v3.43' then raise exception 'Wrong rules engine.'; end if;
  tier := case when c.upgrade_completed and c.upgrade_tier>c.base_tier then c.upgrade_tier else c.base_tier end;
  update challenges set effective_tier=tier,settled_month=month_date where id=cid;
  select coalesce(jsonb_object_agg(cp.user_id::text,pk_current_streak(cp.user_id)),'{}'::jsonb) into before_map from challenge_participants cp where cp.challenge_id=cid;
  for p in select cp.*, case when c.winner_side is null then 'draw' when cp.side=c.winner_side then 'win' else 'loss' end outcome
           from challenge_participants cp where cp.challenge_id=cid loop
    before_streak:=coalesce((before_map->>p.user_id::text)::int,0);
    after_streak:=case when p.outcome='win' then before_streak+1 when p.outcome='loss' then 0 else before_streak end;
    select coalesce(max(coalesce((before_map->>o.user_id::text)::int,0)),0) into opp_streak from challenge_participants o where o.challenge_id=cid and o.side<>p.side;
    streak_pct:=case when p.outcome='win' and not c.is_revenge then after_streak*5 else 0 end;
    bounty_pct:=case when p.outcome='win' and not c.is_revenge and opp_streak>=3 then opp_streak*5 else 0 end;
    awarded:=case
      when p.outcome='win' and c.is_revenge then tier*3
      when p.outcome='win' and stack_mode='multiplicative' then tier*(1+streak_pct/100)*(1+bounty_pct/100)
      when p.outcome='win' then tier*(1+(streak_pct+bounty_pct)/100)
      when p.outcome='loss' and c.is_revenge and p.user_id=c.revenge_user_id then -1
      when p.outcome='loss' and p.completed_properly then 1
      else 0 end;
    awarded:=round(awarded,2);
    insert into pk_points(user_id,challenge_id,points,outcome,department,period_start)
    values(p.user_id,cid,awarded,p.outcome,(select department from profiles where id=p.user_id),month_date)
    on conflict(user_id,challenge_id) do nothing;
    insert into pk_point_ledger(user_id,challenge_id,points,kind,code,period_start,rules_version,details)
    values(p.user_id,cid,awarded,'match',case when p.outcome='win' then 'MATCH_SCORE' when c.is_revenge and p.user_id=c.revenge_user_id then 'REVENGE_FAILURE' when p.completed_properly then 'COMPLETED_LOSS' else 'STOPPED_UPDATE_LOSS' end,month_date,c.rules_version,jsonb_build_object(
      'tier',tier,'outcome',p.outcome,'completed',p.completed_properly,'streak_before',before_streak,
      'streak_after',after_streak,'streak_percent',streak_pct,'bounty_percent',bounty_pct,'revenge',c.is_revenge,
      'stacking',stack_mode)) on conflict do nothing;
    insert into pk_streaks(user_id,current_streak,updated_at) values(p.user_id,after_streak,now())
      on conflict(user_id) do update set current_streak=excluded.current_streak,updated_at=now();
  end loop;
  if c.point_stake>0 and c.winner_side is not null then
    for p in select * from challenge_participants where challenge_id=cid and side<>c.winner_side loop
      insert into pk_point_ledger(user_id,challenge_id,points,kind,code,period_start,rules_version,details)
      values(p.user_id,cid,-c.point_stake,'stake','POINT_STAKE_LOSS',month_date,c.rules_version,jsonb_build_object('direction','paid'));
    end loop;
    for p in select * from challenge_participants where challenge_id=cid and side=c.winner_side loop
      insert into pk_point_ledger(user_id,challenge_id,points,kind,code,period_start,rules_version,details)
      select p.user_id,cid,(c.point_stake*(select count(*) from challenge_participants where challenge_id=cid and side<>c.winner_side)
        /(select count(*) from challenge_participants where challenge_id=cid and side=c.winner_side)),'stake','POINT_STAKE_WIN',month_date,c.rules_version,jsonb_build_object('direction','received');
    end loop;
  end if;
  update challenges set scoring_breakdown=(select jsonb_agg(details || jsonb_build_object('user_id',user_id,'points',points,'code',code) order by user_id) from pk_point_ledger where challenge_id=cid and kind='match') where id=cid;
  insert into pk_monthly_seasons(month_start,ranking_group,prize_pic,prize_amount,penalty_pic)
  select distinct month_date,coalesce(g.ranking_group,pr.department),(select prize_pic from pk_settings where id=1),(select prize_amount from pk_settings where id=1),(select penalty_pic from pk_settings where id=1)
  from challenge_participants cp join profiles pr on pr.id=cp.user_id left join pk_ranking_groups g on g.department=pr.department where cp.challenge_id=cid
  on conflict(month_start,ranking_group) do nothing;
end;
$$;

-- Replace verification while retaining the v3.41 historical scoring path.
create or replace function pk_verify(cid uuid, decision text, note text default null, tiebreak_side text default null)
returns void language plpgsql security definer set search_path = public as $$
declare c challenges := (select x from challenges x where x.id=cid for update); everyone uuid[]:=array(select user_id from challenge_participants where challenge_id=cid); msg text:=nullif(trim(coalesce(note,'')),'');
begin
  if c.id is null or c.pk_version<>1 then raise exception 'PK not found.'; end if;
  if c.status<>'awaiting_verification' then raise exception 'This PK is not waiting for confirmation.'; end if;
  if not pk_can_approve(cid,auth.uid()) then raise exception 'You cannot confirm this PK.'; end if;
  if decision in ('playbook','reopen') and msg is null then raise exception 'Add a note saying what needs fixing.'; end if;
  if decision='reopen' then
    update challenges set status='active',winner_side=null,winner_id=null,final_score_a=null,final_score_b=null,early_settlement=false,settlement_requested_by=null,settlement_requested_at=null where id=cid;
    delete from pk_playbooks where challenge_id=cid; perform pk_log(cid,'reopened',pk_me() || ' reopened the PK: ' || msg); return;
  end if;
  if decision='playbook' then update challenges set status='awaiting_playbook',review_note=msg where id=cid; return; end if;
  if decision<>'confirm' then raise exception 'Unknown decision.'; end if;
  if c.winner_side is null and tiebreak_side in ('A','B') then
    update challenges set winner_side=tiebreak_side,status='awaiting_playbook',winner_id=(select user_id from challenge_participants where challenge_id=cid and side=tiebreak_side order by is_captain desc limit 1) where id=cid; return;
  end if;
  if c.winner_side is not null and not exists(select 1 from pk_playbooks where challenge_id=cid) then raise exception 'The winner has not written a playbook yet.'; end if;
  if c.rules_version='v3.43' then
    if c.upgrade_tier is not null and c.upgrade_evidence is not null then
      update challenges set upgrade_completed=true where id=cid;
      c.upgrade_completed:=true;
    end if;
    perform pk_award_v343(cid);
  else
    insert into pk_points(user_id,challenge_id,points,outcome,department,period_start)
    select p.user_id,cid,case when c.winner_side is null then .5 when p.side=c.winner_side then 3.5 else -.5 end,
      case when c.winner_side is null then 'draw' when p.side=c.winner_side then 'win' else 'loss' end,c.department,pk_quarter(now())
    from challenge_participants p where p.challenge_id=cid on conflict(user_id,challenge_id) do nothing;
  end if;
  update challenges set status='settled',settled_by=auth.uid(),settled_at=now(),settled_month=case when rules_version='v3.43' then pk_month(now()) else settled_month end,review_note=coalesce(msg,review_note) where id=cid;
  perform pk_log(cid,'settled',pk_me() || ' confirmed the result. PK points are in.');
  perform pk_notify(cid,everyone,'"' || c.topic || '" is settled. Open the result to see the scoring breakdown.');
end;
$$;

create or replace function pk_leaderboard(period date default null, dept text default null)
returns table(user_id uuid,username text,role text,department text,avatar_url text,active_border text,active_accessory text,
  points numeric,wins integer,losses integer,draws integer,played integer,win_pct numeric,streak integer,rank integer)
language sql stable security definer set search_path=public as $$
  with wanted as (select coalesce(period,pk_month(now())) m, dept d),
  people as (
    select p.id,p.username,p.role,p.department,p.avatar_url,p.active_border,p.active_accessory,
      coalesce(g.ranking_group,p.department) ranking_group
    from profiles p left join pk_ranking_groups g on g.department=p.department
    where coalesce(p.is_deleted,false)=false and p.department is not null),
  ledger as (select user_id,sum(points)::numeric points from pk_point_ledger,wanted where period_start=wanted.m group by user_id),
  results as (select pp.user_id,count(*) filter(where pp.outcome='win')::int wins,count(*) filter(where pp.outcome='loss')::int losses,
      count(*) filter(where pp.outcome='draw')::int draws from pk_points pp join challenges c on c.id=pp.challenge_id cross join wanted
      where c.rules_version='v3.43' and pp.period_start=wanted.m group by pp.user_id),
  stats as (select pe.id,coalesce(l.points,0)::numeric points,coalesce(r.wins,0)::int wins,coalesce(r.losses,0)::int losses,coalesce(r.draws,0)::int draws
    from people pe cross join wanted w left join ledger l on l.user_id=pe.id left join results r on r.user_id=pe.id
    where w.d is null or pe.department=w.d or pe.ranking_group=w.d)
  select pe.id,pe.username,pe.role,pe.department,pe.avatar_url,pe.active_border,pe.active_accessory,s.points,s.wins,s.losses,s.draws,
    (s.wins+s.losses+s.draws)::int,case when s.wins+s.losses+s.draws=0 then null else round(100*s.wins::numeric/(s.wins+s.losses+s.draws),1) end,
    coalesce(st.current_streak,0),dense_rank() over(order by s.points desc,(s.wins+s.losses+s.draws) desc,pe.username)::int
  from people pe join stats s on s.id=pe.id left join pk_streaks st on st.user_id=pe.id
  order by s.points desc,(s.wins+s.losses+s.draws) desc,pe.username;
$$;

create or replace function pk_bottom_two(period date default null, dept text default null)
returns table(user_id uuid,username text,department text,points numeric,played bigint,rank bigint)
language sql stable security definer set search_path=public as $$
  select l.user_id,l.username,l.department,l.points,l.played,
    row_number() over(order by (l.played=0) desc,l.points asc,l.played asc,l.username)
  from pk_leaderboard(period,dept) l order by (l.played=0) desc,l.points asc,l.played asc,l.username limit 2;
$$;

create or replace function pk_champions(dept text default null)
returns table(period_start date,department text,user_id uuid,username text,avatar_url text,active_border text,active_accessory text,points numeric,wins integer)
language sql stable security definer set search_path=public as $$
  select s.month_start,l.department,l.user_id,l.username,l.avatar_url,l.active_border,l.active_accessory,l.points,l.wins
  from pk_monthly_seasons s cross join lateral pk_leaderboard(s.month_start,s.ranking_group) l
  where l.rank=1 and l.points>0 and (dept is null or l.department=dept or s.ranking_group=dept)
  order by s.month_start desc,l.department,l.username;
$$;

create or replace function pk_archive_seasons()
returns integer language plpgsql security definer set search_path=public as $$
declare r record; n integer:=0;
begin
  for r in select * from pk_monthly_seasons where month_start<pk_month(now()) and archived_at is null for update loop
    update pk_monthly_seasons set archived_at=now(),final_ranking=(select coalesce(jsonb_agg(to_jsonb(x) order by x.rank),'[]'::jsonb) from pk_leaderboard(r.month_start,r.ranking_group) x)
    where month_start=r.month_start and ranking_group=r.ranking_group; n:=n+1;
  end loop;
  return n;
end;
$$;

create or replace function pk_check_missed_updates()
returns integer language plpgsql security definer set search_path=public as $$
declare r record; n integer:=0;
begin
  if not (select reminders_enabled from pk_settings where id=1) then return 0; end if;
  for r in select cp.challenge_id,cp.user_id,c.topic from challenge_participants cp join challenges c on c.id=cp.challenge_id
    where c.rules_version='v3.43' and c.status='active' and cp.stopped_updates_at is null
      and not exists(select 1 from challenge_score_updates u where u.challenge_id=c.id and u.user_id=cp.user_id and u.created_at>now()-pk_update_interval(c.update_frequency))
  loop
    insert into notifications(user_id,type,target_type,target_id,message) values(r.user_id,'challenge','pk',r.challenge_id,'Score update due for "' || r.topic || '". If you stop updating, the loss completion point is forfeited and a violation is recorded.'); n:=n+1;
  end loop;
  return n;
end;
$$;

-- v3.43 no longer creates new PK Money debts; old rows remain readable history.
drop trigger if exists challenges_pk_money on challenges;

create or replace function pk_update_interval(freq text)
returns interval language plpgsql immutable set search_path=public as $$
declare f text:=lower(trim(coalesce(freq,'weekly'))); n integer;
begin
  if f='daily' then return interval '1 day'; end if;
  if f in ('weekly','every monday','every tuesday','every wednesday','every thursday','every friday','every saturday','every sunday') then return interval '7 days'; end if;
  if f='monthly' then return interval '1 month'; end if;
  if f~'^every [0-9]+ days?$' then n:=(regexp_match(f,'[0-9]+'))[1]::int; return make_interval(days=>greatest(n,1)); end if;
  if f~'^every [0-9]+ weeks?$' then n:=(regexp_match(f,'[0-9]+'))[1]::int; return make_interval(days=>greatest(n,1)*7); end if;
  return interval '7 days';
end;
$$;

create or replace function pk_terms_snapshot(cid uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select to_jsonb(t) || jsonb_build_object('participants',coalesce((select jsonb_agg(jsonb_build_object('user_id',p.user_id,'username',pr.username,'side',p.side,
    'is_captain',p.is_captain,'baseline',p.baseline,'target',p.target) order by p.side,pr.username) from challenge_participants p join profiles pr on pr.id=p.user_id where p.challenge_id=cid),'[]'::jsonb))
  from (select topic as title,description,metric,metric_definition,direction,scoring,format,method,pk_type,department,opponent_department,
    winning_target,starts_at,ends_at,update_frequency,reward,punishment,proof_method,tiebreaker,terms_version,rules_version,base_tier,tier_reason,
    upgrade_tier,upgrade_requirement,stake_kind,point_stake,is_revenge from challenges where id=cid) t;
$$;

create or replace function pk_submit_upgrade_evidence(cid uuid,evidence text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from challenges c join challenge_participants p on p.challenge_id=c.id where c.id=cid and c.rules_version='v3.43' and c.upgrade_tier is not null and c.status in ('active','settlement_requested','awaiting_playbook','awaiting_verification') and p.user_id=auth.uid()) then raise exception 'This match has no upgrade evidence for you to submit.'; end if;
  if length(trim(coalesce(evidence,'')))<10 then raise exception 'Describe the evidence clearly.'; end if;
  update challenges set upgrade_evidence=trim(evidence),upgrade_completed=false where id=cid;
  perform pk_log(cid,'upgrade_evidence',pk_me() || ' submitted evidence for the tier upgrade. The result confirmer will verify it.');
end;
$$;

create or replace function pk_dispute_tier(cid uuid,note text)
returns void language plpgsql security definer set search_path=public as $$
declare c challenges:=(select x from challenges x where x.id=cid for update);
begin
  if c.rules_version<>'v3.43' or c.status<>'active' or c.approved_at is null then raise exception 'Only a newly approved live v3.43 match can have a tier dispute.'; end if;
  if not exists(select 1 from challenge_participants where challenge_id=cid and user_id=auth.uid()) then raise exception 'Only a participant can dispute the tier.'; end if;
  if now()>c.approved_at+interval '24 hours' then raise exception 'The 24-hour tier dispute window has closed.'; end if;
  if length(trim(coalesce(note,'')))<10 then raise exception 'Explain the tier concern clearly.'; end if;
  update challenges set tier_disputed_by=auth.uid(),tier_disputed_at=now(),tier_dispute_note=trim(note) where id=cid;
  perform pk_log(cid,'tier_disputed',pk_me() || ' raised a tier dispute within 24 hours: ' || trim(note));
  perform pk_notify(cid,array(select pk_approver_ids(cid)),'Tier dispute on "' || c.topic || '": ' || trim(note));
end;
$$;

create or replace function pk_create(terms jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  uid uuid:=auth.uid(); dept text:=(select department from profiles where id=auth.uid()); new_id uuid:=gen_random_uuid();
  fmt text:=coalesce(terms->>'format','head_to_head'); mth text:=coalesce(terms->>'method','named');
  requested_type text:=coalesce(terms->>'match_type',case when coalesce((terms->>'team')::boolean,false) then 'team' else 'one_v_one' end);
  s pk_settings:=(select x from pk_settings x where x.id=1); p jsonb; opp uuid; opp_dept text; tier smallint;
  revenge boolean:=coalesce((terms->>'is_revenge')::boolean,false); stake numeric:=coalesce(nullif(terms->>'point_stake','')::numeric,0);
begin
  if uid is null then raise exception 'Sign in first.'; end if;
  if dept is null then raise exception 'Set your department before starting a PK.'; end if;
  if not coalesce((terms->>'compliance_agreed')::boolean,false) then raise exception 'Please agree to the fair-play rules first.'; end if;
  if mth not in ('named','open') or fmt not in ('head_to_head','self_declaration') then raise exception 'Unknown challenge type.'; end if;
  if requested_type not in ('one_v_one','vs_upline','team','department') then raise exception 'Unknown match type.'; end if;
  if requested_type in ('team','department') and (mth='open' or fmt='self_declaration') then raise exception 'Team and department PKs must be named head-to-head challenges.'; end if;
  tier:=coalesce(nullif(terms->>'base_tier','')::smallint,case when fmt='self_declaration' then case when coalesce((terms->>'company_metric')::boolean,false) then 10 else 5 end else 5 end);
  if tier not in (5,8,10) then raise exception 'Tier must be 5, 8 or 10 points.'; end if;
  if coalesce(trim(terms->>'tier_reason'),'')='' then raise exception 'Explain why this topic belongs in the selected tier.'; end if;
  if stake<0 or stake>3 then raise exception 'A PK point stake must be between 0 and 3.'; end if;
  if nullif(terms->>'upgrade_tier','') is not null and ((terms->>'upgrade_tier')::smallint<=tier or coalesce(trim(terms->>'upgrade_requirement'),'')='') then raise exception 'A tier upgrade needs a higher tier and a pre-agreed evidence requirement.'; end if;
  if stake>0 and coalesce(terms->>'stake_kind','')<>'pk_points' then raise exception 'Point stake value requires the PK points stake type.'; end if;
  if revenge and (requested_type not in ('one_v_one','vs_upline') or mth<>'named') then raise exception 'Revenge is for a named 1v1 match.'; end if;
  if revenge and exists(select 1 from challenges where revenge_user_id=uid and is_revenge and pk_month(starts_at)=pk_month(coalesce(nullif(terms->>'starts_at','')::timestamptz,now())) and status not in ('rejected','cancelled','expired','declined','terminated')) then
    raise exception 'You already used your revenge match this month.';
  end if;

  insert into challenges(id,pk_version,rules_version,creator_id,topic,description,metric,metric_definition,direction,scoring,format,method,
    pk_type,department,winning_target,starts_at,ends_at,update_frequency,reward,punishment,pk_money,proof_method,tiebreaker,
    compliance_agreed,status,expires_at,base_tier,tier_reason,upgrade_tier,upgrade_requirement,stake_kind,point_stake,is_revenge,revenge_user_id)
  values(new_id,1,'v3.43',uid,trim(terms->>'title'),nullif(trim(terms->>'description'),''),trim(terms->>'metric'),
    nullif(trim(terms->>'metric_definition'),''),terms->>'direction',case when fmt='self_declaration' then null else terms->>'scoring' end,
    fmt,mth,requested_type,dept,nullif(terms->>'winning_target','')::numeric,coalesce(nullif(terms->>'starts_at','')::timestamptz,now()),
    (terms->>'ends_at')::timestamptz,nullif(trim(terms->>'update_frequency'),''),nullif(trim(terms->>'reward'),''),
    nullif(trim(terms->>'punishment'),''),0,nullif(trim(terms->>'proof_method'),''),nullif(trim(terms->>'tiebreaker'),''),true,
    'awaiting_opponent',case when mth='open' then now()+make_interval(days=>s.open_expiry_days) end,tier,trim(terms->>'tier_reason'),
    nullif(terms->>'upgrade_tier','')::smallint,nullif(trim(terms->>'upgrade_requirement'),''),
    nullif(terms->>'stake_kind',''),stake,revenge,case when revenge then uid end);

  insert into challenge_participants(challenge_id,user_id,side,is_captain,accepted_at,baseline,target)
  values(new_id,uid,'A',true,now(),nullif(terms->'creator'->>'baseline','')::numeric,nullif(terms->'creator'->>'target','')::numeric);
  if mth='named' then
    for p in select * from jsonb_array_elements(coalesce(terms->'participants','[]'::jsonb)) loop
      if (p->>'user_id')::uuid=uid then continue; end if;
      insert into challenge_participants(challenge_id,user_id,side,is_captain,baseline,target)
      values(new_id,(p->>'user_id')::uuid,coalesce(p->>'side','B'),coalesce((p->>'is_captain')::boolean,requested_type not in ('team','department')),
        nullif(p->>'baseline','')::numeric,nullif(p->>'target','')::numeric);
    end loop;
    opp:=(select user_id from challenge_participants where challenge_id=new_id and side='B' order by is_captain desc limit 1);
    if opp is null then raise exception 'Choose who you are challenging.'; end if;
    opp_dept:=(select department from profiles where id=opp);
    if requested_type not in ('team','department') and (select count(*) from challenge_participants where challenge_id=new_id)<>2 then raise exception 'A 1v1 has exactly one opponent.'; end if;
    if requested_type in ('team','department') and ((select count(*) from challenge_participants where challenge_id=new_id and side='A') not between 2 and 5 or (select count(*) from challenge_participants where challenge_id=new_id and side='A')<>(select count(*) from challenge_participants where challenge_id=new_id and side='B')) then raise exception 'Both teams need 2 to 5 people and must be the same size.'; end if;
    if requested_type='department' and (opp_dept is null or opp_dept=dept) then raise exception 'Choose an opposing department for a department PK.'; end if;
    if requested_type='department' and exists(select 1 from challenge_participants cp join profiles pr on pr.id=cp.user_id where cp.challenge_id=new_id and ((cp.side='A' and pr.department is distinct from dept) or (cp.side='B' and pr.department is distinct from opp_dept))) then raise exception 'Each side of a department PK must contain people from exactly one department.'; end if;
  end if;
  update challenges set opponent_id=opp,opponent_department=opp_dept,
    pk_type=case when requested_type='one_v_one' and opp is not null and pk_rank_of(uid)>pk_rank_of(opp) then 'vs_upline' else requested_type end,
    winning_target=case when fmt='self_declaration' then (select target from challenge_participants where challenge_id=new_id and user_id=uid) else winning_target end
  where id=new_id;
  if (select pk_type from challenges where id=new_id)='vs_upline' and pk_rank_of(uid)-pk_rank_of(opp)>=2 then
    if tier<>10 then raise exception 'A challenge two or more levels up must use Tier 10.'; end if;
    if exists(select 1 from challenges c where c.id<>new_id and c.creator_id=uid and c.pk_type='vs_upline' and abs(pk_rank_of(c.creator_id)-pk_rank_of(c.opponent_id))>=2
      and pk_month(c.starts_at)=pk_month((select starts_at from challenges where id=new_id)) and c.status not in ('rejected','cancelled','expired','declined','terminated')) then
      raise exception 'A challenge two or more levels up is limited to once per month.';
    end if;
  end if;
  if exists(select 1 from challenges c where c.id=(select x.id from challenges x where x.creator_id=uid and x.id<>new_id order by x.created_at desc limit 1)
      and c.is_revenge and c.revenge_user_id=uid and c.opponent_id=opp) then
    raise exception 'Your next match after revenge must be against someone else.';
  end if;
  perform pk_check_terms(new_id);
  for p in select jsonb_build_object('user_id',user_id) from challenge_participants where challenge_id=new_id loop
    perform pk_check_participant(new_id,(p->>'user_id')::uuid);
  end loop;
  if requested_type<>'department' and exists(select 1 from challenge_participants cp join profiles pr on pr.id=cp.user_id where cp.challenge_id=new_id and pr.department is distinct from dept) then
    raise exception 'Everyone must be in % for this match type.',dept;
  end if;
  perform pk_record_terms(new_id,'proposed');
  perform pk_log(new_id,'created',pk_me() || case when mth='open' then ' posted an open challenge.' else ' issued the challenge.' end);
  perform pk_notify(new_id,array(select user_id from challenge_participants where challenge_id=new_id and user_id<>uid),pk_me() || ' challenged you to a PK: ' || trim(terms->>'title'));
  return new_id;
end;
$$;

create or replace function pk_update_settings(changes jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare k text; ints text[]:=array['open_expiry_days','max_counter_rounds']; flags text[]:=array['reminders_enabled','announce_live','announce_winner']; texts text[]:=array['prize_pic','prize_amount','penalty_pic','penalty_notice'];
begin
  if not viewer_is_admin() then raise exception 'Only admins can change PK settings.'; end if;
  for k in select jsonb_object_keys(changes) loop
    if k=any(ints) then
      if (changes->>k)::int<0 or (changes->>k)::int>100 then raise exception '% must be between 0 and 100.',k; end if;
      execute format('update pk_settings set %I=$1 where id=1',k) using (changes->>k)::smallint;
    elsif k=any(flags) then execute format('update pk_settings set %I=$1 where id=1',k) using (changes->>k)::boolean;
    elsif k=any(texts) then
      if coalesce(trim(changes->>k),'')='' then raise exception '% cannot be empty.',k; end if;
      execute format('update pk_settings set %I=$1 where id=1',k) using trim(changes->>k);
    elsif k='bonus_stacking' and changes->>k in ('additive','multiplicative') then update pk_settings set bonus_stacking=changes->>k where id=1;
    else raise exception 'Unknown setting: %',k;
    end if;
  end loop;
end;
$$;

create or replace function pk_terminate(cid uuid,reason text,note text)
returns void language plpgsql security definer set search_path=public as $$
declare c challenges:=(select x from challenges x where x.id=cid for update); msg text:=nullif(trim(coalesce(note,'')),''); label text:=case reason when 'resignation' then 'a resignation' when 'transfer' then 'a transfer' when 'data_failure' then 'a data or system failure' when 'customer_pool_change' then 'a customer pool change' when 'emergency' then 'an emergency' else 'a special case' end;
begin
  if c.id is null or c.pk_version<>1 then raise exception 'PK not found.'; end if;
  if not (viewer_is_admin() or pk_can_approve(cid,auth.uid())) then raise exception 'Only an admin or eligible upline can terminate this PK.'; end if;
  if c.status not in ('active','settlement_requested','awaiting_playbook','awaiting_verification') then raise exception 'Only an approved unsettled PK can be terminated.'; end if;
  if reason not in ('resignation','transfer','data_failure','customer_pool_change','emergency','other') then raise exception 'Pick a reason.'; end if;
  if msg is null then raise exception 'Add a note explaining what happened.'; end if;
  update challenges set status='terminated',terminated_reason=reason,terminated_note=msg,terminated_by=auth.uid(),terminated_at=now(),winner_side=null,winner_id=null where id=cid;
  perform pk_log(cid,'terminated',pk_me() || ' terminated the PK because of ' || label || ': ' || msg);
  perform pk_notify(cid,array(select user_id from challenge_participants where challenge_id=cid),'"' || c.topic || '" was terminated because of ' || label || '. No winner or PK points.' || case when c.rules_version<>'v3.43' and c.pk_money>0 then ' Its historical PK Money stake is void.' else '' end);
end;
$$;

create or replace function pk_accept_open(cid uuid,my_baseline numeric default null,my_target numeric default null)
returns void language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); c challenges:=(select x from challenges x where x.id=cid for update); distance integer;
begin
  if c.id is null or c.pk_version<>1 or c.method<>'open' then raise exception 'Open challenge not found.'; end if;
  if c.status<>'awaiting_opponent' or c.opponent_id is not null then raise exception 'Someone has already taken this challenge.'; end if;
  if c.expires_at is not null and c.expires_at<=now() then update challenges set status='expired' where id=cid; raise exception 'This open challenge has expired.'; end if;
  if uid=c.creator_id then raise exception 'You cannot accept your own challenge.'; end if;
  if (select department from profiles where id=uid) is distinct from c.department then raise exception 'Only someone in the same department may accept this challenge.'; end if;
  insert into challenge_participants(challenge_id,user_id,side,is_captain,accepted_at,baseline,target) values(cid,uid,'B',true,now(),my_baseline,my_target);
  distance:=abs(pk_rank_of(uid)-pk_rank_of(c.creator_id));
  update challenges set opponent_id=uid,pk_type=case when pk_rank_of(c.creator_id)>pk_rank_of(uid) then 'vs_upline' else 'one_v_one' end,expires_at=null where id=cid;
  if pk_rank_of(c.creator_id)>pk_rank_of(uid) and distance>=2 then
    if c.base_tier<>10 then raise exception 'A challenge two or more levels up must use Tier 10.'; end if;
    if exists(select 1 from challenges x where x.id<>cid and x.creator_id=c.creator_id and x.pk_type='vs_upline' and abs(pk_rank_of(x.creator_id)-pk_rank_of(x.opponent_id))>=2 and pk_month(x.starts_at)=pk_month(c.starts_at) and x.status not in ('rejected','cancelled','expired','declined','terminated')) then raise exception 'A challenge two or more levels up is limited to once per month.'; end if;
  end if;
  perform pk_check_terms(cid); perform pk_check_participant(cid,uid); perform pk_check_participant(cid,c.creator_id);
  perform pk_record_terms(cid,'accepted_open'); perform pk_log(cid,'accepted',pk_me() || ' took the open challenge.');
  perform pk_notify(cid,array[c.creator_id],pk_me() || ' accepted your open challenge: ' || c.topic); perform pk_all_accepted(cid);
end;
$$;

create or replace function pk_respond(cid uuid,response text,counter jsonb default null)
returns void language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); c challenges:=(select x from challenges x where x.id=cid for update); me challenge_participants:=(select x from challenge_participants x where x.challenge_id=cid and x.user_id=auth.uid()); s pk_settings:=(select x from pk_settings x where x.id=1); others uuid[]:=array(select user_id from challenge_participants where challenge_id=cid); p jsonb;
begin
  if c.id is null or c.pk_version<>1 then raise exception 'PK not found.'; end if;
  if me.user_id is null then raise exception 'You are not part of this PK.'; end if;
  if c.status not in ('awaiting_opponent','countered') then raise exception 'This PK is not waiting for a response.'; end if;
  if response='decline' then update challenges set status='declined' where id=cid; perform pk_log(cid,'declined',pk_me() || ' declined the challenge.'); perform pk_notify(cid,others,pk_me() || ' declined your PK: ' || c.topic); return; end if;
  if me.accepted_at is not null then raise exception 'You already accepted these terms.'; end if;
  if response='accept' then perform pk_check_participant(cid,uid); update challenge_participants set accepted_at=now() where challenge_id=cid and user_id=uid; perform pk_log(cid,'accepted',pk_me() || ' accepted the terms.'); perform pk_notify(cid,others,pk_me() || ' accepted your PK: ' || c.topic); perform pk_all_accepted(cid); return; end if;
  if response<>'counter' then raise exception 'Unknown response.'; end if;
  if not me.is_captain then raise exception 'Only a team captain can counter-propose.'; end if;
  if c.counter_round>=s.max_counter_rounds then raise exception 'The counter-proposal limit has been reached.'; end if;
  update challenges set
    description=coalesce(nullif(trim(counter->>'description'),''),description),metric=coalesce(nullif(trim(counter->>'metric'),''),metric),
    metric_definition=coalesce(nullif(trim(counter->>'metric_definition'),''),metric_definition),direction=coalesce(counter->>'direction',direction),
    scoring=case when format='self_declaration' then null else coalesce(counter->>'scoring',scoring) end,
    winning_target=case when counter?'winning_target' then nullif(counter->>'winning_target','')::numeric else winning_target end,
    starts_at=coalesce(nullif(counter->>'starts_at','')::timestamptz,starts_at),ends_at=coalesce(nullif(counter->>'ends_at','')::timestamptz,ends_at),
    update_frequency=coalesce(nullif(trim(counter->>'update_frequency'),''),update_frequency),reward=case when counter?'reward' then nullif(trim(counter->>'reward'),'') else reward end,
    punishment=case when counter?'punishment' then nullif(trim(counter->>'punishment'),'') else punishment end,proof_method=coalesce(nullif(trim(counter->>'proof_method'),''),proof_method),
    tiebreaker=case when counter?'tiebreaker' then nullif(trim(counter->>'tiebreaker'),'') else tiebreaker end,
    base_tier=coalesce(nullif(counter->>'base_tier','')::smallint,base_tier),tier_reason=coalesce(nullif(trim(counter->>'tier_reason'),''),tier_reason),
    upgrade_tier=case when counter?'upgrade_tier' then nullif(counter->>'upgrade_tier','')::smallint else upgrade_tier end,
    upgrade_requirement=case when counter?'upgrade_requirement' then nullif(trim(counter->>'upgrade_requirement'),'') else upgrade_requirement end,
    upgrade_evidence=null,upgrade_completed=false,stake_kind=case when counter?'stake_kind' then nullif(counter->>'stake_kind','') else stake_kind end,
    point_stake=case when counter?'point_stake' then coalesce(nullif(counter->>'point_stake','')::numeric,0) else point_stake end,
    counter_round=counter_round+1,terms_version=terms_version+1,status='countered'
  where id=cid;
  for p in select * from jsonb_array_elements(coalesce(counter->'participants','[]'::jsonb)) loop
    update challenge_participants set baseline=nullif(p->>'baseline','')::numeric,target=nullif(p->>'target','')::numeric where challenge_id=cid and user_id=(p->>'user_id')::uuid;
  end loop;
  update challenges set winning_target=(select target from challenge_participants where challenge_id=cid and side='A' limit 1) where id=cid and format='self_declaration';
  update challenge_participants set accepted_at=case when user_id=uid then now() end where challenge_id=cid;
  c:=(select x from challenges x where x.id=cid);
  if c.base_tier not in (5,8,10) or coalesce(trim(c.tier_reason),'')='' then raise exception 'Choose a valid tier and explain it.'; end if;
  if c.upgrade_tier is not null and (c.upgrade_tier<=c.base_tier or coalesce(trim(c.upgrade_requirement),'')='') then raise exception 'A tier upgrade needs a higher tier and pre-agreed evidence requirement.'; end if;
  if c.point_stake<0 or c.point_stake>3 then raise exception 'A PK point stake must be between 0 and 3.'; end if;
  if c.pk_type='vs_upline' and pk_rank_of(c.creator_id)-pk_rank_of(c.opponent_id)>=2 and c.base_tier<>10 then raise exception 'A challenge two or more levels up must use Tier 10.'; end if;
  perform pk_check_terms(cid); for p in select to_jsonb(x) from challenge_participants x where challenge_id=cid loop perform pk_check_participant(cid,(p->>'user_id')::uuid); end loop;
  perform pk_record_terms(cid,'countered'); perform pk_log(cid,'countered',pk_me() || ' sent a counter-proposal.'); perform pk_notify(cid,others,pk_me() || ' sent a counter-proposal on: ' || c.topic);
end;
$$;

grant execute on function pk_month(timestamptz),pk_month_balance(uuid,date),pk_point_committed(uuid,date,uuid),pk_is_banned(uuid,date),pk_pending_approvals(),pk_review(uuid,boolean,text),pk_verify(uuid,text,text,text),pk_mark_stopped(uuid,uuid,text),pk_submit_upgrade_evidence(uuid,text),pk_dispute_tier(uuid,text),pk_leaderboard(date,text),pk_bottom_two(date,text) to authenticated;
grant execute on function pk_create(jsonb) to authenticated;
grant execute on function pk_update_settings(jsonb) to authenticated;
grant execute on function pk_terminate(uuid,text,text) to authenticated;
grant execute on function pk_accept_open(uuid,numeric,numeric) to authenticated;
grant execute on function pk_respond(uuid,text,jsonb) to authenticated;
grant execute on function pk_champions(text) to authenticated;
revoke all on function pk_archive_seasons() from public,anon,authenticated;
revoke execute on function pk_mark_paid(uuid,boolean),pk_money_summary(),pk_money_limit(uuid),pk_money_used(uuid,date,uuid) from authenticated;

do $$
declare t text;
begin
  foreach t in array array['pk_point_ledger','pk_streaks','pk_monthly_seasons'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename=t) then execute format('alter publication supabase_realtime add table %I',t); end if;
  end loop;
  if exists(select 1 from cron.job where jobname='pk-archive-monthly-seasons') then perform cron.unschedule('pk-archive-monthly-seasons'); end if;
  perform cron.schedule('pk-archive-monthly-seasons','15 0 * * *','select pk_archive_seasons()');
exception when others then raise warning 'Realtime or monthly PK archive scheduling unavailable: %',sqlerrm;
end;
$$;
revoke all on function pk_prepare_approvals(uuid),pk_record_violation(uuid,uuid,text,text),pk_award_v343(uuid) from public,anon,authenticated;
