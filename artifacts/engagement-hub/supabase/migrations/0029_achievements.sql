-- Achievements (profile titles) catalog, so admins can add their own and give
-- them to people. Built-in ones still unlock automatically; none give points.

create table if not exists achievements (
  key text primary key,
  label text not null check (length(trim(label)) between 1 and 40),
  description text not null default '',
  builtin boolean not null default false,
  created_at timestamptz not null default now()
);

insert into achievements (key, label, description, builtin) values
  ('newcomer', 'Newcomer', 'Joined the team', true),
  ('goal_getter', 'Goal Getter', 'Completed your first goal', true),
  ('overachiever', 'Overachiever', 'Completed 5 goals', true),
  ('streak_starter', 'Streak Starter', '3-day login streak', true),
  ('streak_master', 'Streak Master', '7-day login streak', true),
  ('record_holder', 'Record Holder', 'Claimed a Guinness record', true),
  ('philanthropist', 'Philanthropist', 'Gifted points to a teammate', true),
  ('word_wizard', 'Word Wizard', 'Solved the daily Wordle', true),
  ('quiz_whiz', 'Quiz Whiz', 'Answered 5 quiz questions correctly', true)
on conflict (key) do nothing;

alter table achievements enable row level security;
drop policy if exists "achievements_read" on achievements;
create policy "achievements_read" on achievements for select using (true);
drop policy if exists "achievements_admin" on achievements;
create policy "achievements_admin" on achievements for all to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));

-- Deleting a custom achievement also takes it off everyone who has it.
create or replace function remove_deleted_achievement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles set unlocked_titles = array_remove(unlocked_titles, old.key),
                      active_title = case when active_title = old.key then null else active_title end
  where old.key = any(unlocked_titles);
  return old;
end;
$$;

drop trigger if exists on_achievement_delete on achievements;
create trigger on_achievement_delete after delete on achievements
  for each row execute function remove_deleted_achievement();

-- Give or take away an achievement.
create or replace function admin_set_achievement(target_user uuid, achievement_key text, has_it boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then raise exception 'Not authorized'; end if;
  if not exists (select 1 from achievements where key = achievement_key) then raise exception 'Achievement not found'; end if;
  if has_it then
    perform public.award_title(target_user, achievement_key);
  else
    update profiles set unlocked_titles = array_remove(unlocked_titles, achievement_key),
                        active_title = case when active_title = achievement_key then null else active_title end
    where id = target_user;
  end if;
end;
$$;
grant execute on function admin_set_achievement(uuid, text, boolean) to authenticated;

-- Use the catalog's name in "Achievement unlocked" notifications.
create or replace function notify_profile_rewards()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gained integer := coalesce(new.points, 0) - coalesce(old.points, 0);
  t text;
begin
  if gained > 0 and coalesce(current_setting('app.skip_points_notify', true), 'off') <> 'on' then
    insert into notifications (user_id, actor_id, type, target_type, target_id, message)
    values (new.id, null, 'points', 'profile', new.id,
            'You earned ' || gained || ' point' || case when gained = 1 then '' else 's' end || ' · balance ' || new.points);
  end if;
  for t in select unnest(coalesce(new.unlocked_titles, '{}')) except select unnest(coalesce(old.unlocked_titles, '{}')) loop
    insert into notifications (user_id, actor_id, type, target_type, target_id, message)
    values (new.id, null, 'achievement', 'profile', new.id,
            'Achievement unlocked: ' || coalesce((select label from achievements where key = t), initcap(replace(t, '_', ' '))));
  end loop;
  return new;
end;
$$;
