-- PK system, part 7: superior approval and expiry of open challenges nobody took.

create or replace function pk_review(cid uuid, approve boolean, note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  c challenges := (select x from challenges x where x.id = cid for update);
  p record;
begin
  if c.id is null or c.pk_version <> 1 then raise exception 'PK not found.'; end if;
  if c.status <> 'awaiting_approval' then raise exception 'This PK isn''t waiting for approval.'; end if;
  if not pk_can_approve(cid, auth.uid()) then raise exception 'You can''t approve this PK.'; end if;

  if not approve then
    if coalesce(trim(note), '') = '' then raise exception 'Say why you''re rejecting it, so they can fix it.'; end if;
    update challenges set status = 'rejected', review_note = trim(note), approved_by = auth.uid(), approved_at = now() where id = cid;
    perform pk_log(cid, 'rejected', pk_me() || ' rejected the PK: ' || trim(note));
    perform pk_notify(cid, array(select user_id from challenge_participants where challenge_id = cid),
      'Your PK "' || c.topic || '" wasn''t approved: ' || trim(note));
    return;
  end if;

  perform pk_check_terms(cid);
  for p in select user_id from challenge_participants where challenge_id = cid loop
    perform pk_check_participant(cid, p.user_id);
  end loop;
  update challenges set status = 'active', review_note = nullif(trim(note), ''), approved_by = auth.uid(), approved_at = now()
  where id = cid;
  perform pk_record_terms(cid, 'approved');
  perform pk_log(cid, 'approved', pk_me() || ' approved the PK. It''s on!');
  perform pk_notify(cid, array(select user_id from challenge_participants where challenge_id = cid),
    'Your PK "' || c.topic || '" was approved. It''s on!');
end;
$$;

-- Open challenges nobody took within pk_settings.open_expiry_days.
create or replace function pk_expire_open()
returns integer language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  with gone as (
    update challenges set status = 'expired'
    where pk_version = 1 and method = 'open' and status = 'awaiting_opponent' and expires_at <= now()
    returning id)
  insert into challenge_events (challenge_id, kind, message) select id, 'expired', 'Nobody accepted in time, so it expired.' from gone;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function pk_review(uuid, boolean, text) to authenticated;
revoke all on function pk_expire_open() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'pk-expire-open') then perform cron.unschedule('pk-expire-open'); end if;
  perform cron.schedule('pk-expire-open', '20 * * * *', 'select pk_expire_open()');
exception when others then
  raise warning 'pg_cron unavailable, open PK expiry not scheduled: %', sqlerrm;
end;
$$;
