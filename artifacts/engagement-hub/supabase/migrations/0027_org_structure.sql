-- Roles and departments become admin-managed tables instead of fixed lists.
-- Role rank matters (challenges compare upline/downline): 1 = most senior.

create table if not exists org_roles (
  name text primary key check (length(trim(name)) between 1 and 40),
  rank integer not null
);
create table if not exists org_departments (
  name text primary key check (length(trim(name)) between 1 and 40),
  sort integer not null
);

insert into org_roles (name, rank)
select r, i from unnest(array['CEO','HOD','MANAGER','SPV','ASPV','TL','ATL','SNR','JNR']) with ordinality as t(r, i)
on conflict (name) do nothing;
insert into org_departments (name, sort)
select d, i from unnest(array['RTN VIP','RTN EXC','MANAGEMENT','DESIGN','DATA ANALYST','MARKETING']) with ordinality as t(d, i)
on conflict (name) do nothing;

alter table org_roles enable row level security;
alter table org_departments enable row level security;
drop policy if exists "org_roles_read" on org_roles;
create policy "org_roles_read" on org_roles for select using (true);
drop policy if exists "org_departments_read" on org_departments;
create policy "org_departments_read" on org_departments for select using (true);

-- The fixed CHECK lists would reject new roles/departments; validate against
-- the tables instead.
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles drop constraint if exists profiles_department_check;

create or replace function validate_role_department()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is not null and not exists (select 1 from org_roles where name = new.role) then
    raise exception 'Invalid role: %', new.role;
  end if;
  if new.department is not null and not exists (select 1 from org_departments where name = new.department) then
    raise exception 'Invalid department: %', new.department;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_role_department on profiles;
create trigger validate_role_department
  before insert or update of role, department on profiles
  for each row
  execute function validate_role_department();

create or replace function admin_set_role_department(user_id_param uuid, role_param text, department_param text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Not authorized';
  end if;
  if role_param is not null and not exists (select 1 from org_roles where name = role_param) then
    raise exception 'Invalid role';
  end if;
  if department_param is not null and not exists (select 1 from org_departments where name = department_param) then
    raise exception 'Invalid department';
  end if;
  perform set_config('app.role_admin_override', 'true', true);
  update public.profiles set role = role_param, department = department_param where id = user_id_param;
end;
$$;

create or replace function set_my_role_department(role_param text, department_param text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if role_param is null or department_param is null then
    raise exception 'Role and department are both required';
  end if;
  if not exists (select 1 from org_roles where name = role_param) then raise exception 'Invalid role'; end if;
  if not exists (select 1 from org_departments where name = department_param) then raise exception 'Invalid department'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and (role is not null or department is not null)) then
    raise exception 'Your role/department is already set. Ask an admin to change it.';
  end if;
  update public.profiles set role = role_param, department = department_param where id = auth.uid();
end;
$$;
