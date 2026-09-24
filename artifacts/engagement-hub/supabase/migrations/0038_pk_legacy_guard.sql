-- PK system, part 9: the old challenge functions only work on old challenges.
-- New challenges go through pk_create; old ones stay as history.

create or replace function create_challenge(opponent_id_param uuid, topic_param text, description_param text,
  reward_param text, punishment_param text, ends_at_param timestamptz, metric_param text default null)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  raise exception 'Challenges moved to the PK Arena. Refresh the page to start a PK.';
end;
$$;

-- The legacy score/complete functions check only status, so stop them
-- touching PK rows here. PK rows never use the legacy score columns or
-- the "pending"/"completed" statuses.
create or replace function pk_guard_legacy()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.pk_version = 1 and not (viewer_is_admin() and old.approved_at is null) then
      raise exception 'PKs are kept for the record. An admin can remove one only before it''s approved.';
    end if;
    return old;
  end if;
  if old.pk_version = 1 and (new.score_creator is distinct from old.score_creator
      or new.score_opponent is distinct from old.score_opponent
      or new.status in ('pending', 'completed') or new.pk_version <> 1) then
    raise exception 'This is a PK. Use the PK Arena to update it.';
  end if;
  return new;
end;
$$;

drop trigger if exists challenges_pk_guard on challenges;
create trigger challenges_pk_guard before update or delete on challenges
  for each row execute function pk_guard_legacy();

-- Admins remove unapproved PKs with this (delete_challenge only allows old statuses).
create or replace function pk_delete(cid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not viewer_is_admin() then raise exception 'Only an admin can remove a PK.'; end if;
  delete from challenges where id = cid and pk_version = 1;
end;
$$;
grant execute on function pk_delete(uuid) to authenticated;
