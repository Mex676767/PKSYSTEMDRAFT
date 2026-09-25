begin;

alter table public.org_departments
  add column if not exists show_in_hall_of_fame boolean not null default true;

create or replace function public.admin_set_hof_department_visibility(
  department_name text,
  visible boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.hof_can_manage('manage_hof_awards') then
    raise exception 'You do not have permission to manage Hall of Fame departments.' using errcode = '42501';
  end if;

  update public.org_departments
  set show_in_hall_of_fame = visible
  where name = department_name;

  if not found then
    raise exception 'Department not found.';
  end if;
end;
$$;

revoke all on function public.admin_set_hof_department_visibility(text, boolean) from public;
grant execute on function public.admin_set_hof_department_visibility(text, boolean) to authenticated;

notify pgrst, 'reload schema';

commit;
