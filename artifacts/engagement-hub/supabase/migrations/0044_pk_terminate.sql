-- PK system, part 14: termination. Special cases (resignation, transfer, data
-- or system failure, customer pool change, emergency) end a PK without it
-- counting as quitting: no winner, no PK points, the PK Money stake is void.

alter table challenges
  add column if not exists terminated_reason text check (terminated_reason in
    ('resignation', 'transfer', 'data_failure', 'customer_pool_change', 'emergency', 'other')),
  add column if not exists terminated_note text,
  add column if not exists terminated_by uuid references profiles(id) on delete set null,
  add column if not exists terminated_at timestamptz;

-- An admin or an eligible approver can terminate a PK once it's been approved
-- (before that, the creator can just cancel it).
create or replace function pk_terminate(cid uuid, reason text, note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  c challenges := (select x from challenges x where x.id = cid for update);
  msg text := nullif(trim(coalesce(note, '')), '');
  label text := case reason
    when 'resignation' then 'a resignation' when 'transfer' then 'a transfer'
    when 'data_failure' then 'a data or system failure' when 'customer_pool_change' then 'a customer pool change'
    when 'emergency' then 'an emergency' else 'a special case' end;
begin
  if c.id is null or c.pk_version <> 1 then raise exception 'PK not found.'; end if;
  if not (viewer_is_admin() or pk_can_approve(cid, auth.uid())) then
    raise exception 'Only an admin or an upline who can approve this PK can terminate it.';
  end if;
  if c.status not in ('active', 'settlement_requested', 'awaiting_playbook', 'awaiting_verification') then
    raise exception 'Only an approved PK that isn''t settled yet can be terminated.';
  end if;
  if reason not in ('resignation', 'transfer', 'data_failure', 'customer_pool_change', 'emergency', 'other') then
    raise exception 'Pick a reason.';
  end if;
  if msg is null then raise exception 'Add a note explaining what happened.'; end if;

  update challenges set status = 'terminated', terminated_reason = reason, terminated_note = msg,
    terminated_by = auth.uid(), terminated_at = now(), winner_side = null, winner_id = null
  where id = cid;
  perform pk_log(cid, 'terminated', pk_me() || ' terminated the PK because of ' || label || ': ' || msg);
  perform pk_notify(cid, array(select user_id from challenge_participants where challenge_id = cid),
    '"' || c.topic || '" was terminated because of ' || label || '. No points, and any PK Money stake is void.');
end;
$$;

grant execute on function pk_terminate(uuid, text, text) to authenticated;
