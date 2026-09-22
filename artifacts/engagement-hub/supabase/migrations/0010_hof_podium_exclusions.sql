-- Lets an admin, or anyone holding the manage_hof_awards permission, exclude
-- a specific person from the Hall of Fame monthly podium (e.g. a manager who
-- shouldn't compete against their own reports, or correcting a mistake).
create table if not exists hof_podium_exclusions (
  user_id uuid primary key references profiles(id) on delete cascade,
  excluded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table hof_podium_exclusions enable row level security;

drop policy if exists "hof_podium_exclusions_select_authenticated" on hof_podium_exclusions;
create policy "hof_podium_exclusions_select_authenticated"
  on hof_podium_exclusions for select
  to authenticated
  using (true);

create or replace function hof_set_podium_exclusion(target_user uuid, excluded boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from profiles
    where id = auth.uid()
      and (is_admin = true or 'manage_hof_awards' = any(permissions))
  ) then
    raise exception 'Not authorized';
  end if;

  if excluded then
    insert into hof_podium_exclusions (user_id, excluded_by)
    values (target_user, auth.uid())
    on conflict (user_id) do nothing;
  else
    delete from hof_podium_exclusions where user_id = target_user;
  end if;
end;
$$;

grant execute on function hof_set_podium_exclusion(uuid, boolean) to authenticated;

-- Re-create the podium function to skip anyone currently excluded.
create or replace function hof_monthly_podium(target_month date)
returns table (
  department text,
  rank int,
  user_id uuid,
  username text,
  avatar_url text,
  active_border text,
  total_points bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with month_totals as (
    select
      p.department,
      p.id as user_id,
      p.username,
      p.avatar_url,
      p.active_border,
      coalesce(sum(pt.amount), 0)::bigint as total_points
    from profiles p
    left join point_transactions pt
      on pt.user_id = p.id
      and pt.created_at >= date_trunc('month', target_month)
      and pt.created_at < date_trunc('month', target_month) + interval '1 month'
    where p.department is not null
      and p.is_deleted = false
      and not exists (select 1 from hof_podium_exclusions e where e.user_id = p.id)
    group by p.department, p.id, p.username, p.avatar_url, p.active_border
  ),
  ranked as (
    select
      month_totals.*,
      row_number() over (
        partition by month_totals.department
        order by month_totals.total_points desc, month_totals.username asc
      ) as rnk
    from month_totals
    where total_points > 0
  )
  select ranked.department, ranked.rnk::int, ranked.user_id, ranked.username,
         ranked.avatar_url, ranked.active_border, ranked.total_points
  from ranked
  where rnk <= 3
  order by ranked.department, ranked.rnk;
end;
$$;

grant execute on function hof_monthly_podium(date) to authenticated;
