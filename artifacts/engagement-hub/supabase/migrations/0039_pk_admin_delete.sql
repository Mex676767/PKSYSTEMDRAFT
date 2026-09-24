-- Admins can delete any PK (e.g. test PKs), even after approval.
-- Everyone else still can't delete PKs.
create or replace function pk_guard_legacy()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.pk_version = 1 and not viewer_is_admin() then
      raise exception 'Only an admin can delete a PK.';
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
