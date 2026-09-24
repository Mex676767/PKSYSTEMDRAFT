-- Admin actions for roles and departments. kind is 'role' or 'department'.

-- Add (old_name null) or rename. Renaming updates everyone who has it (and,
-- for departments, their Hall of Fame categories).
create or replace function admin_org_save(kind text, old_name text, new_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean text := upper(trim(new_name));
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then raise exception 'Not authorized'; end if;
  if kind not in ('role', 'department') then raise exception 'Unknown kind'; end if;
  if clean is null or clean = '' then raise exception 'Name is required'; end if;
  if old_name is not null and old_name = clean then return; end if;
  if (kind = 'role' and exists (select 1 from org_roles where name = clean))
     or (kind = 'department' and exists (select 1 from org_departments where name = clean)) then
    raise exception '"%" already exists', clean;
  end if;

  if old_name is null then
    if kind = 'role' then
      insert into org_roles (name, rank) values (clean, coalesce((select max(rank) from org_roles), 0) + 1);
    else
      insert into org_departments (name, sort) values (clean, coalesce((select max(sort) from org_departments), 0) + 1);
    end if;
    return;
  end if;

  perform set_config('app.role_admin_override', 'true', true);
  if kind = 'role' then
    update org_roles set name = clean where name = old_name;
    if not found then raise exception 'Role not found'; end if;
    update profiles set role = clean where role = old_name;
  else
    update org_departments set name = clean where name = old_name;
    if not found then raise exception 'Department not found'; end if;
    update profiles set department = clean where department = old_name;
    if to_regclass('public.hof_award_categories') is not null then
      update hof_award_categories set department = clean where department = old_name;
    end if;
  end if;
end;
$$;
-- Move one place up (-1) or down (+1) in the order.
create or replace function admin_org_move(kind text, item_name text, direction integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  mine integer;
  other_name text;
  other integer;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then raise exception 'Not authorized'; end if;
  if kind = 'role' then
    mine := (select rank from org_roles where name = item_name);
    other_name := (select name from org_roles where case when direction < 0 then rank < mine else rank > mine end
                   order by case when direction < 0 then -rank else rank end limit 1);
    if mine is null or other_name is null then return; end if;
    other := (select rank from org_roles where name = other_name);
    update org_roles set rank = case when name = item_name then other else mine end where name in (item_name, other_name);
  else
    mine := (select sort from org_departments where name = item_name);
    other_name := (select name from org_departments where case when direction < 0 then sort < mine else sort > mine end
                   order by case when direction < 0 then -sort else sort end limit 1);
    if mine is null or other_name is null then return; end if;
    other := (select sort from org_departments where name = other_name);
    update org_departments set sort = case when name = item_name then other else mine end where name in (item_name, other_name);
  end if;
end;
$$;
-- Remove, only once nobody has it.
create or replace function admin_org_delete(kind text, item_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  in_use integer;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then raise exception 'Not authorized'; end if;
  in_use := case when kind = 'role' then (select count(*) from profiles where role = item_name)
                 else (select count(*) from profiles where department = item_name) end;
  if in_use > 0 then
    raise exception '% still % "%". Reassign them first.', in_use, case when in_use = 1 then 'person has' else 'people have' end, item_name;
  end if;
  if kind = 'role' then delete from org_roles where name = item_name;
  else delete from org_departments where name = item_name; end if;
end;
$$;

grant execute on function admin_org_save(text, text, text), admin_org_move(text, text, integer), admin_org_delete(text, text) to authenticated;
