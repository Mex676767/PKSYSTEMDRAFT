-- Run in Supabase SQL Editor. All changes are transactional.
begin;
create or replace function public.hof_can_manage(permission_name text)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and is_deleted = false and (is_admin = true or permission_name = any(permissions))); $$;
revoke all on function public.hof_can_manage(text) from public;
grant execute on function public.hof_can_manage(text) to authenticated;

create table if not exists public.hof_deletion_logs (
 id uuid primary key default gen_random_uuid(),
 deleted_at timestamptz not null default now(),
 deleted_by uuid,
 deleted_by_name text,
 entity_type text not null,
 entity_id uuid not null,
 snapshot jsonb not null
);
alter table public.hof_deletion_logs enable row level security;
revoke all on public.hof_deletion_logs from anon, authenticated;
grant select on public.hof_deletion_logs to authenticated;
drop policy if exists hof_logs_read on public.hof_deletion_logs;
create policy hof_logs_read on public.hof_deletion_logs for select to authenticated
using (public.hof_can_manage('manage_hof_awards') or public.hof_can_manage('manage_hall_of_fame'));

create table if not exists public.hof_award_categories (
 id uuid primary key default gen_random_uuid(),
 department text not null check (length(trim(department)) > 0),
 name text not null check (length(trim(name)) between 1 and 100),
 created_at timestamptz not null default now(),
 unique(department, name)
);
create table if not exists public.hof_award_winners (
 id uuid primary key default gen_random_uuid(),
 category_id uuid not null references public.hof_award_categories(id) on delete cascade,
 month date not null check (extract(day from month) = 1),
 rank integer not null check (rank between 1 and 3),
 user_id uuid not null references public.profiles(id),
 achievement text not null default '' check (length(achievement) <= 150),
 unique(category_id, month, rank),
 unique(category_id, month, user_id)
);
alter table public.hof_award_categories enable row level security;
alter table public.hof_award_winners enable row level security;
grant select, insert, update, delete on public.hof_award_categories to authenticated;
grant select on public.hof_award_winners to authenticated;
revoke insert, update, delete on public.hof_award_winners from authenticated;
drop policy if exists hof_categories_read on public.hof_award_categories;
create policy hof_categories_read on public.hof_award_categories for select to authenticated using (true);
drop policy if exists hof_categories_manage on public.hof_award_categories;
create policy hof_categories_manage on public.hof_award_categories for all to authenticated using (public.hof_can_manage('manage_hof_awards')) with check (public.hof_can_manage('manage_hof_awards'));
drop policy if exists hof_winners_read on public.hof_award_winners;
create policy hof_winners_read on public.hof_award_winners for select to authenticated using (true);

-- Log every record deletion, including deletes outside the app. No client can
-- insert, edit or erase audit entries. Failure to log rolls back the deletion.
create or replace function public.hof_audit_delete()
returns trigger language plpgsql security definer set search_path = public as $$
declare details jsonb;
begin
 details := to_jsonb(old);
 if tg_table_name = 'hof_records' then
   details := details || jsonb_build_object('category_name', (select name from public.hof_categories where id = old.category_id), 'holder_name', (select username from public.profiles where id = old.holder_id));
 end if;
 if tg_table_name = 'hof_award_categories' then
   details := details || jsonb_build_object('winners', (select coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb) from public.hof_award_winners w where category_id = old.id));
 end if;
 insert into public.hof_deletion_logs(deleted_by, deleted_by_name, entity_type, entity_id, snapshot)
 values(auth.uid(), (select username from public.profiles where id = auth.uid()), tg_table_name, old.id, details);
 return old;
end; $$;
revoke all on function public.hof_audit_delete() from public;
drop trigger if exists hof_records_audit_delete on public.hof_records;
create trigger hof_records_audit_delete before delete on public.hof_records for each row execute function public.hof_audit_delete();
drop trigger if exists guinness_categories_audit_delete on public.hof_categories;
create trigger guinness_categories_audit_delete before delete on public.hof_categories for each row execute function public.hof_audit_delete();
drop trigger if exists hof_categories_audit_delete on public.hof_award_categories;
create trigger hof_categories_audit_delete before delete on public.hof_award_categories for each row execute function public.hof_audit_delete();
drop trigger if exists hof_winners_audit_delete on public.hof_award_winners;
create trigger hof_winners_audit_delete before delete on public.hof_award_winners for each row execute function public.hof_audit_delete();

-- Explicit authorization avoids silent zero-row DELETEs caused by RLS.
create or replace function public.hof_delete_record(target_record uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
 if not public.hof_can_manage('manage_hall_of_fame') then raise exception 'Only administrators or Guinness Records managers can delete records.' using errcode = '42501'; end if;
 delete from public.hof_records where id = target_record;
 if not found then raise exception 'This record no longer exists.'; end if;
end; $$;
revoke all on function public.hof_delete_record(uuid) from public;
grant execute on function public.hof_delete_record(uuid) to authenticated;

create or replace function public.hof_delete_category(target_category uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
 if not public.hof_can_manage('manage_hall_of_fame') then raise exception 'Only administrators or Guinness Records managers can delete categories.' using errcode = '42501'; end if;
 perform 1 from public.hof_categories where id = target_category for update;
 if not found then raise exception 'This category no longer exists.'; end if;
 delete from public.hof_records where category_id = target_category;
 delete from public.hof_categories where id = target_category;
end; $$;
revoke all on function public.hof_delete_category(uuid) from public;
grant execute on function public.hof_delete_category(uuid) to authenticated;

-- Replace one monthly podium atomically; serialize editors of a category.
create or replace function public.hof_save_winners(target_category uuid, target_month date, winners jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
 if not public.hof_can_manage('manage_hof_awards') then raise exception 'Not authorized' using errcode = '42501'; end if;
 perform 1 from public.hof_award_categories where id = target_category for update;
 if not found then raise exception 'Category no longer exists.'; end if;
 if target_month is null or extract(day from target_month) <> 1 then raise exception 'Select a calendar month.'; end if;
 if winners is null or jsonb_typeof(winners) <> 'array' then raise exception 'Invalid winners.'; end if;
 if jsonb_array_length(winners) > 3 then raise exception 'At most three winners are allowed.'; end if;
 -- Replace the previous selections, auditing the removed rows. This also allows rank swaps.
 delete from public.hof_award_winners where category_id = target_category and month = target_month;
 insert into public.hof_award_winners(category_id, month, rank, user_id, achievement)
 select target_category, target_month, x.rank, x.user_id, coalesce(x.achievement, '')
 from jsonb_to_recordset(winners) as x(rank integer, user_id uuid, achievement text);
end; $$;
revoke all on function public.hof_save_winners(uuid,date,jsonb) from public;
grant execute on function public.hof_save_winners(uuid,date,jsonb) to authenticated;

-- Retire automatic ranking/exclusion endpoints. The old exclusion table is
-- retained only as historical data; it no longer controls any display.
drop function if exists public.hof_set_podium_exclusion(uuid,boolean);
drop function if exists public.hof_monthly_podium(date);
notify pgrst, 'reload schema';
commit;
