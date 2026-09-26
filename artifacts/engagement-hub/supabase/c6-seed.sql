-- C6 (or any new organisation): run once in the new Supabase project's SQL
-- editor, AFTER schema.sql and the migrations. A structure-only export has no
-- rows, so this adds the settings rows and defaults the app expects, the
-- scheduled jobs, and live updates. Safe to run again. See docs/C6-SETUP.md.

insert into birthday_email_settings (id) values (1) on conflict (id) do nothing;
insert into points_settings (id) values (1) on conflict (id) do nothing;
insert into pk_settings (id) values (1) on conflict (id) do nothing;

-- Default roles and departments; rename or remove them in Admin.
insert into org_roles (name, rank)
select r, i from unnest(array['CEO','HOD','MANAGER','SPV','ASPV','TL','ATL','SNR','JNR']) with ordinality as t(r, i)
on conflict (name) do nothing;
insert into org_departments (name, sort)
select d, i from unnest(array['MANAGEMENT']) with ordinality as t(d, i)
on conflict (name) do nothing;

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

-- New sign-ups get a profile. The trigger sits on auth.users, which a
-- public-schema export doesn't include.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Photo storage: one public bucket, same rules as C9MYR.
insert into storage.buckets (id, name, public) values ('post-images', 'post-images', true)
on conflict (id) do update set public = true;
drop policy if exists "Anyone can view post images" on storage.objects;
create policy "Anyone can view post images" on storage.objects for select
  using (bucket_id = 'post-images');
drop policy if exists "Authenticated users can upload post images" on storage.objects;
create policy "Authenticated users can upload post images" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-images');
drop policy if exists "Users can delete their own post images" on storage.objects;
create policy "Users can delete their own post images" on storage.objects for delete
  using (bucket_id = 'post-images' and owner = auth.uid());

-- Scheduled jobs (these live outside the table structure).
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule(jobname) from cron.job
where jobname in ('birthday-notifications', 'birthday-emails', 'pk-expire-open', 'pk-auto-settle', 'pk-missed-updates');
select cron.schedule('birthday-notifications', '5 * * * *', 'select notify_todays_birthdays()');
select cron.schedule('birthday-emails', '10 * * * *', 'select trigger_birthday_emails()');
select cron.schedule('pk-expire-open', '20 * * * *', 'select pk_expire_open()');
select cron.schedule('pk-auto-settle', '40 * * * *', 'select pk_auto_settle()');
select cron.schedule('pk-missed-updates', '50 * * * *', 'select pk_check_missed_updates()');

-- Live updates for the tables the app listens to.
do $$
declare t text;
begin
  foreach t in array array['posts', 'comments', 'reactions', 'goals', 'goal_updates', 'notifications', 'direct_messages',
    'challenges', 'challenge_participants', 'challenge_events', 'challenge_score_updates', 'pk_points', 'pk_playbooks',
    'pk_money_debts', 'discord_presence', 'gratitude_letters'] loop
    if to_regclass('public.' || t) is not null and not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end;
$$;
