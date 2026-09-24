-- Points revamp, part 3: mission periods, progress and the member-facing list.
-- Daily / weekly (Mon-Sun) / monthly periods follow points_settings.timezone.
-- Special missions run between starts_at and ends_at and can be done once.

create or replace function mission_window(cadence text, starts_at timestamptz, ends_at timestamptz, tz text)
returns table (period_start date, win_start timestamptz, win_end timestamptz)
language sql
stable
set search_path = public
as $$
  select
    case when cadence = 'special' then date '2000-01-01' else x.d end,
    case when cadence = 'special' then coalesce(starts_at, '-infinity'::timestamptz) else x.d::timestamp at time zone tz end,
    case when cadence = 'special' then coalesce(ends_at, 'infinity'::timestamptz) else (x.d + x.step) at time zone tz end
  from (
    select
      case cadence
        when 'weekly' then date_trunc('week', now() at time zone tz)::date
        when 'monthly' then date_trunc('month', now() at time zone tz)::date
        else (now() at time zone tz)::date
      end as d,
      case cadence
        when 'weekly' then interval '7 days'
        when 'monthly' then interval '1 month'
        else interval '1 day'
      end as step
  ) x;
$$;

create or replace function mission_progress(uid uuid, kind text, win_start timestamptz, win_end timestamptz, tz text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when kind = 'manual' then 0
    when kind = 'login' then (
      select count(distinct (a.occurred_at at time zone tz)::date)::int
      from mission_activity a
      where a.user_id = uid and a.kind = 'login' and a.occurred_at >= win_start and a.occurred_at < win_end
    )
    else (
      select count(distinct coalesce(a.ref_id, a.id::text))::int
      from mission_activity a
      where a.user_id = uid and a.kind = mission_progress.kind and a.occurred_at >= win_start and a.occurred_at < win_end
    )
  end;
$$;

-- Adds (or with a negative amount, removes) points and records why. Internal:
-- only the functions below call it.
create or replace function points_ledger_add(uid uuid, amount integer, reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The generic "You earned N points" notification is skipped; callers send
  -- their own, more specific one.
  perform set_config('app.skip_points_notify', 'on', true);
  update profiles set points = coalesce(points, 0) + amount where id = uid;
  perform set_config('app.skip_points_notify', 'off', true);
  insert into point_transactions (user_id, amount, reason) values (uid, amount, reason);
end;
$$;
revoke all on function points_ledger_add(uuid, integer, text) from public, anon, authenticated;

create or replace function get_my_missions()
returns table (
  id uuid, title text, description text, cadence text, kind text, target_count integer, points integer,
  starts_at timestamptz, ends_at timestamptz, progress integer, claim_status text, resets_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.title, m.description, m.cadence, m.kind, m.target_count, m.points, m.starts_at, m.ends_at,
         least(mission_progress(auth.uid(), m.kind, w.win_start, w.win_end, s.timezone), m.target_count),
         c.status,
         case when m.cadence = 'special' then m.ends_at else w.win_end end
  from points_settings s
  cross join missions m
  cross join lateral mission_window(m.cadence, m.starts_at, m.ends_at, s.timezone) w
  left join mission_claims c on c.mission_id = m.id and c.user_id = auth.uid() and c.period_start = w.period_start
  where s.id = 1 and s.revamp_enabled and m.active and auth.uid() is not null
    and (m.cadence <> 'special' or ((m.starts_at is null or m.starts_at <= now()) and (m.ends_at is null or m.ends_at > now())))
  order by array_position(array['daily', 'weekly', 'monthly', 'special'], m.cadence), m.created_at;
$$;
grant execute on function get_my_missions() to authenticated;
