-- Support individual ties and team-led awards in the monthly Hall of Fame.
begin;

alter table public.hof_award_categories
  add column if not exists award_type text not null default 'individual'
  check (award_type in ('individual', 'team'));

alter table public.hof_award_winners
  add column if not exists team_member_ids uuid[] not null default '{}'::uuid[];

-- Individual awards can have ties, so place is no longer unique. Each person
-- can still appear only once within a category and month.
alter table public.hof_award_winners
  drop constraint if exists hof_award_winners_category_id_month_rank_key;

-- Keep winner replacement atomic and restricted to Hall of Fame managers.
create or replace function public.hof_save_winners(target_category uuid, target_month date, winners jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
 winner_data jsonb;
 member_data jsonb;
 winner_rank integer;
 winner_user uuid;
 member_ids uuid[];
 assigned_ids uuid[] := '{}'::uuid[];
 distinct_member_count integer;
 valid_member_count integer;
 category_type text;
begin
 if not public.hof_can_manage('manage_hof_awards') then raise exception 'Not authorized' using errcode = '42501'; end if;
 select award_type into category_type from public.hof_award_categories where id = target_category for update;
 if not found then raise exception 'Category no longer exists.'; end if;
 if target_month is null or extract(day from target_month) <> 1 then raise exception 'Select a calendar month.'; end if;
 if winners is null or jsonb_typeof(winners) <> 'array' then raise exception 'Invalid winners.'; end if;
 if jsonb_array_length(winners) > 300 then raise exception 'At most 100 tied winners per place are allowed.'; end if;
 if exists (
   select 1 from jsonb_array_elements(winners) as items(value)
   group by (value->>'rank')::integer having count(*) > 100
 ) then raise exception 'At most 100 tied winners per place are allowed.'; end if;
 if category_type = 'team' and exists (
   select 1 from jsonb_array_elements(winners) as items(value)
   group by (value->>'rank')::integer having count(*) > 1
 ) then raise exception 'Team awards allow one lead per place.'; end if;

 -- Validate all leads and teammates before deleting the previous selections.
 for winner_data in select value from jsonb_array_elements(winners) as items(value)
 loop
   winner_rank := (winner_data->>'rank')::integer;
   winner_user := (winner_data->>'user_id')::uuid;
   if winner_rank is null or winner_rank not between 1 and 3 or winner_user is null then
     raise exception 'Each podium place needs a lead and a valid rank.';
   end if;
   if winner_user = any(assigned_ids) then
     raise exception 'A person can only appear once on this podium.';
   end if;
   assigned_ids := array_append(assigned_ids, winner_user);

   member_data := coalesce(winner_data->'team_member_ids', '[]'::jsonb);
   if jsonb_typeof(member_data) is distinct from 'array' then
     raise exception 'Team members must be a list of people.';
   end if;
   if category_type = 'individual' and jsonb_array_length(member_data) > 0 then
     raise exception 'Individual awards cannot include team members.';
   end if;
   select coalesce(array_agg(item.value::uuid order by item.ordinality), '{}'::uuid[])
     into member_ids
     from jsonb_array_elements_text(member_data) with ordinality as item(value, ordinality);

   select count(distinct person_id) into distinct_member_count
     from unnest(member_ids) as listed(person_id);
   if cardinality(member_ids) <> coalesce(distinct_member_count, 0) then
     raise exception 'A team member cannot be listed more than once.';
   end if;
   if exists (select 1 from unnest(member_ids) as listed(person_id) where person_id = any(assigned_ids)) then
     raise exception 'A person can only appear once on this podium.';
   end if;
   if cardinality(member_ids) > 0 then
     select count(*) into valid_member_count from public.profiles where id = any(member_ids);
     if valid_member_count <> cardinality(member_ids) then
       raise exception 'One or more selected team members no longer exist.';
     end if;
     assigned_ids := assigned_ids || member_ids;
   end if;
 end loop;

 delete from public.hof_award_winners where category_id = target_category and month = target_month;
 for winner_data in select value from jsonb_array_elements(winners) as items(value)
 loop
   select coalesce(array_agg(item.value::uuid order by item.ordinality), '{}'::uuid[])
     into member_ids
     from jsonb_array_elements_text(coalesce(winner_data->'team_member_ids', '[]'::jsonb))
       with ordinality as item(value, ordinality);
   insert into public.hof_award_winners(category_id, month, rank, user_id, achievement, team_member_ids)
   values (
     target_category,
     target_month,
     (winner_data->>'rank')::integer,
     (winner_data->>'user_id')::uuid,
     coalesce(winner_data->>'achievement', ''),
     member_ids
   );
 end loop;
end; $$;

revoke all on function public.hof_save_winners(uuid,date,jsonb) from public;
grant execute on function public.hof_save_winners(uuid,date,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
