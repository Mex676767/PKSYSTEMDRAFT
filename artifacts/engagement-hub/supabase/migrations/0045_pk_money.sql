-- PK system, part 15: PK Money is tracked only, never paid through the site.
-- When a PK with a stake settles, each loser owes the stake, split evenly
-- across the winners. The person owed marks it received.

create table if not exists pk_money_debts (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges(id) on delete cascade,
  debtor_id uuid not null references profiles(id) on delete cascade,
  creditor_id uuid not null references profiles(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (challenge_id, debtor_id, creditor_id)
);
alter table pk_money_debts enable row level security;
drop policy if exists "pk_money_debts_read" on pk_money_debts;
create policy "pk_money_debts_read" on pk_money_debts for select to authenticated
  using (auth.uid() in (debtor_id, creditor_id) or viewer_is_admin());

create or replace function pk_record_debts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.pk_version = 1 and new.status = 'settled' and old.status is distinct from 'settled'
     and new.pk_money > 0 and new.winner_side is not null then
    insert into pk_money_debts (challenge_id, debtor_id, creditor_id, amount)
    select new.id, l.user_id, w.user_id,
      round(new.pk_money / (select count(*) from challenge_participants where challenge_id = new.id and side = new.winner_side), 2)
    from challenge_participants l
    join challenge_participants w on w.challenge_id = l.challenge_id and w.side = new.winner_side
    where l.challenge_id = new.id and l.side <> new.winner_side
    on conflict do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists challenges_pk_money on challenges;
create trigger challenges_pk_money after update on challenges for each row execute function pk_record_debts();

create or replace function pk_mark_paid(debt_id uuid, paid boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  update pk_money_debts set paid_at = case when paid then now() end
  where id = debt_id and (creditor_id = auth.uid() or viewer_is_admin());
  if not found then raise exception 'Only the person who''s owed can mark this as received.'; end if;
end;
$$;

-- This month's allowance for the signed-in person, and money owed either way.
create or replace function pk_money_summary()
returns table (month_start date, allowance numeric, used numeric, remaining numeric, owed_to_me numeric, i_owe numeric)
language sql stable security definer set search_path = public as $$
  with m as (select date_trunc('month', now() at time zone 'Asia/Kuala_Lumpur')::date as d)
  select m.d, pk_money_limit(auth.uid()), pk_money_used(auth.uid(), m.d),
    greatest(pk_money_limit(auth.uid()) - pk_money_used(auth.uid(), m.d), 0),
    coalesce((select sum(amount) from pk_money_debts where creditor_id = auth.uid() and paid_at is null), 0),
    coalesce((select sum(amount) from pk_money_debts where debtor_id = auth.uid() and paid_at is null), 0)
  from m;
$$;

grant execute on function pk_mark_paid(uuid, boolean), pk_money_summary() to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'pk_money_debts') then
    alter publication supabase_realtime add table pk_money_debts;
  end if;
exception when others then
  raise warning 'Realtime not enabled for PK Money: %', sqlerrm;
end;
$$;
