-- Daily login keeps the streak and its login achievements, but no longer
-- gives points. It used to detect "already claimed today" by finding today's
-- +10 ledger row; that row no longer exists, so it uses last_login_date.
create or replace function claim_daily_login_bonus()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  prev_login date := (select last_login_date from public.profiles where id = auth.uid());
  new_streak integer;
begin
  perform public.award_title(auth.uid(), 'newcomer');
  if prev_login = current_date then return false; end if;
  new_streak := case when prev_login = current_date - 1
    then coalesce((select current_streak from public.profiles where id = auth.uid()), 0) + 1 else 1 end;
  update public.profiles
  set last_login_date = current_date, current_streak = new_streak, longest_streak = greatest(longest_streak, new_streak)
  where id = auth.uid();
  if new_streak >= 3 then perform public.award_title(auth.uid(), 'streak_starter'); end if;
  if new_streak >= 7 then perform public.award_title(auth.uid(), 'streak_master'); end if;
  return true;
end;
$$;
