-- Points only come from missions and the admin panel (they'll have monetary
-- value). Transfers of existing points (gifts, bets, reward refunds) still work.
-- Achievements keep unlocking; they just no longer come with points.
--
-- Background: every point_transactions insert updates profiles.points via the
-- apply_point_transaction trigger. That makes the ledger the one place to
-- gate: new points are only accepted when an allowed function says so.

-- 1. points_ledger_add (missions, rewards, refunds) also updated the balance
--    itself, so those changes were applied twice. Ledger insert only now.
create or replace function points_ledger_add(uid uuid, amount integer, reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.points_allowed', 'on', true);
  -- Callers send their own, more specific notification.
  perform set_config('app.skip_points_notify', 'on', true);
  insert into point_transactions (user_id, amount, reason) values (uid, amount, reason);
  perform set_config('app.skip_points_notify', 'off', true);
  perform set_config('app.points_allowed', 'off', true);
end;
$$;
revoke all on function points_ledger_add(uuid, integer, text) from public, anon, authenticated;

-- 2. Undo the double-counted amounts once (the ledger rows are correct).
create table if not exists points_maintenance_log (key text primary key, applied_at timestamptz not null default now());
alter table points_maintenance_log enable row level security;

do $$
begin
  if not exists (select 1 from points_maintenance_log where key = 'undo_double_ledger_0025') then
    perform set_config('app.skip_points_notify', 'on', true); -- a correction, not earned points
    update profiles p
    set points = p.points - d.extra
    from (
      select user_id, sum(amount)::int as extra
      from point_transactions
      where reason like 'Mission: %' or reason like 'Reward: %' or reason like 'Refund: %'
      group by user_id
    ) d
    where d.user_id = p.id and d.extra <> 0;
    insert into points_maintenance_log (key) values ('undo_double_ledger_0025');
    perform set_config('app.skip_points_notify', 'off', true);
  end if;
end;
$$;

-- 3. Gate new points. Spending (negative) always goes through; positive
--    amounts need an allowed caller or are transfers of existing points.
create or replace function guard_point_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.amount <= 0
     or coalesce(current_setting('app.points_allowed', true), 'off') = 'on'
     or new.reason like 'Gift received%'
     or new.reason in ('Won a bet', 'Bet refunded (no winners)', 'Bet cancelled (refund)') then
    return new;
  end if;
  return null; -- skipped: no ledger row, no balance change
end;
$$;

drop trigger if exists guard_point_transaction on point_transactions;
create trigger guard_point_transaction
  before insert on point_transactions
  for each row
  execute function guard_point_transaction();

-- 4. Admin panel adjustments are an allowed source.
create or replace function admin_adjust_points(target_user uuid, amount integer, reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.viewer_is_admin() then raise exception 'Not authorized'; end if;
  if amount = 0 then raise exception 'Amount cannot be zero'; end if;
  if not exists (select 1 from public.profiles where id = target_user) then raise exception 'User not found'; end if;
  perform set_config('app.points_allowed', 'on', true);
  insert into public.point_transactions (user_id, amount, reason)
  values (target_user, amount, coalesce(nullif(trim(reason), ''), 'Admin adjustment'));
  perform set_config('app.points_allowed', 'off', true);
end;
$$;
