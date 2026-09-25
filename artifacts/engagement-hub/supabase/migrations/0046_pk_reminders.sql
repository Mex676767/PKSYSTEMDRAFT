-- PK system, part 16: missed score updates at the PK's frequency. 1st miss:
-- reminder; 2nd: recorded warning; 3rd: a violation for uplines. Posting resets it.

alter table challenge_participants add column if not exists missed_count integer not null default 0;
alter table pk_settings
  add column if not exists reminders_enabled boolean not null default true,
  add column if not exists announce_live boolean not null default true,
  add column if not exists announce_winner boolean not null default true;

create table if not exists pk_violations (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null default 'missed_updates',
  note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles(id) on delete set null,
  resolution text
);
alter table pk_violations enable row level security;
drop policy if exists "pk_violations_read" on pk_violations;
create policy "pk_violations_read" on pk_violations for select to authenticated
  using (user_id = auth.uid() or viewer_is_admin());

-- Days between expected updates, from the agreed frequency text.
create or replace function pk_update_interval(freq text)
returns integer language sql immutable as $$
  select case
    when freq ~* 'daily|every day|each day' then 1
    when freq ~* '2 days|two days|every other day' then 2
    when freq ~* 'month' then 30
    else 7 end;
$$;

-- Posting a score clears the missed count.
create or replace function pk_reset_missed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update challenge_participants set missed_count = 0 where challenge_id = new.challenge_id and user_id = new.user_id;
  return new;
end;
$$;
drop trigger if exists challenge_score_updates_reset_missed on challenge_score_updates;
create trigger challenge_score_updates_reset_missed after insert on challenge_score_updates
  for each row execute function pk_reset_missed();

-- Hourly: whole update periods since the last update (or start); skipped steps still log.
create or replace function pk_check_missed_updates()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer;
  acted integer := 0;
begin
  if not coalesce((select reminders_enabled from pk_settings where id = 1), true) then return 0; end if;
  for r in
    select p.challenge_id, p.user_id, p.missed_count, c.topic, pk_update_interval(c.update_frequency) as every_days,
      greatest(c.starts_at, coalesce(c.approved_at, c.starts_at),
        coalesce((select max(u.created_at) from challenge_score_updates u where u.challenge_id = c.id and u.user_id = p.user_id), c.starts_at)) as since,
      (select username from profiles where id = p.user_id) as who
    from challenges c join challenge_participants p on p.challenge_id = c.id
    where c.pk_version = 1 and c.status = 'active' and now() < c.ends_at
      and (c.format <> 'self_declaration' or p.side = 'A')
  loop
    n := floor(extract(epoch from now() - r.since) / (r.every_days * 86400))::int;
    continue when n <= r.missed_count;
    update challenge_participants set missed_count = n where challenge_id = r.challenge_id and user_id = r.user_id;
    acted := acted + 1;
    insert into notifications (user_id, type, target_type, target_id, message)
    values (r.user_id, 'challenge', 'pk', r.challenge_id, case
      when n = 1 then 'Reminder: post your score update (with proof) for "' || r.topic || '".'
      when n = 2 then 'Warning: you''ve missed 2 score updates on "' || r.topic || '". One more counts as a violation.'
      when r.missed_count < 3 and n >= 3 then 'You''ve missed ' || n || ' score updates on "' || r.topic || '". This was recorded as a violation.'
      else 'You''ve now missed ' || n || ' score updates on "' || r.topic || '". Please update it.' end);
    if r.missed_count < 2 and n >= 2 then
      insert into challenge_events (challenge_id, kind, message)
      values (r.challenge_id, 'warning', '@' || coalesce(r.who, 'someone') || ' missed 2 score updates in a row (warning).');
    end if;
    if r.missed_count < 3 and n >= 3 then
      insert into challenge_events (challenge_id, kind, message)
      values (r.challenge_id, 'violation', '@' || coalesce(r.who, 'someone') || ' missed 3 score updates in a row (violation).');
      insert into pk_violations (challenge_id, user_id, note) values (r.challenge_id, r.user_id, 'Missed 3 score updates in a row.');
      insert into notifications (user_id, type, target_type, target_id, message)
      select a, 'challenge', 'pk', r.challenge_id, '@' || coalesce(r.who, 'someone') || ' missed 3 score updates on "' || r.topic || '".'
      from pk_approver_ids(r.challenge_id) a;
    end if;
  end loop;
  return acted;
end;
$$;
revoke all on function pk_check_missed_updates() from public, anon, authenticated;
do $$
begin
  if exists (select 1 from cron.job where jobname = 'pk-missed-updates') then perform cron.unschedule('pk-missed-updates'); end if;
  perform cron.schedule('pk-missed-updates', '50 * * * *', 'select pk_check_missed_updates()');
exception when others then
  raise warning 'pg_cron unavailable, missed-update reminders not scheduled: %', sqlerrm;
end;
$$;
