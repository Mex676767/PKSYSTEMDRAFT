-- Monthly KPI podium for the Hall of Fame page: top 3 point-earners per
-- department for a given calendar month. "Points earned that month" is the
-- KPI, computed from the existing point_transactions ledger rather than a
-- separate tracked metric.
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
    where p.department is not null and p.is_deleted = false
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
