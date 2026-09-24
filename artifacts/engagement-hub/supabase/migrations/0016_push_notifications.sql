-- Browser push notifications, plus in-app notifications for birthdays, goals,
-- points and achievements. Every row inserted into `notifications` (old types
-- and new) is also pushed to the recipient's subscribed devices by the
-- send-push edge function. Setup steps: supabase/PUSH-NOTIFICATIONS.md.

create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Devices subscribed to push. One row per browser; re-subscribing the same
-- browser (same endpoint) moves it to whoever is signed in now.
-- ---------------------------------------------------------------------------
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_own_select" on push_subscriptions;
create policy "push_subscriptions_own_select"
  on push_subscriptions for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "push_subscriptions_own_delete" on push_subscriptions;
create policy "push_subscriptions_own_delete"
  on push_subscriptions for delete to authenticated
  using (user_id = auth.uid());

-- Upsert through a function: the endpoint may already belong to another
-- account that used this browser before, which RLS wouldn't let us update.
create or replace function save_push_subscription(endpoint_param text, p256dh_param text, auth_param text, user_agent_param text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  insert into push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), endpoint_param, p256dh_param, auth_param, user_agent_param)
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        created_at = now();
end;
$$;

grant execute on function save_push_subscription(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- New notification types. Drop any check constraint that pins `type` to the
-- original list (its name isn't known here) so the new types can be stored.
-- ---------------------------------------------------------------------------
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname = 'notifications'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%type%'
  loop
    execute format('alter table notifications drop constraint %I', c.conname);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Hand every new notification to send-push. Needs two Vault secrets:
-- `project_url` and `push_webhook_secret` (see the setup doc). Until they
-- exist, or if anything goes wrong, the notification is still saved; it just
-- isn't pushed.
-- ---------------------------------------------------------------------------
create or replace function push_new_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_url text;
  webhook_secret text;
begin
  begin
    select decrypted_secret into project_url from vault.decrypted_secrets where name = 'project_url';
    select decrypted_secret into webhook_secret from vault.decrypted_secrets where name = 'push_webhook_secret';
    if project_url is null or webhook_secret is null then
      return new;
    end if;
    if not exists (select 1 from push_subscriptions where user_id = new.user_id) then
      return new;
    end if;
    perform net.http_post(
      url := rtrim(project_url, '/') || '/functions/v1/send-push',
      body := jsonb_build_object('notification_id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', webhook_secret)
    );
  exception when others then
    raise warning 'push_new_notification: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists on_notification_push on notifications;
create trigger on_notification_push
  after insert on notifications
  for each row
  execute function push_new_notification();

-- ---------------------------------------------------------------------------
-- Goals: tell the owner when a goal is marked complete.
-- ---------------------------------------------------------------------------
create or replace function notify_goal_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.completed and not coalesce(old.completed, false) then
    insert into notifications (user_id, actor_id, type, target_type, target_id, message)
    values (new.owner_id, null, 'goal', 'goal', new.id, 'You completed your goal "' || left(new.title, 80) || '" 🎉');
  end if;
  return new;
end;
$$;

drop trigger if exists on_goal_completed on goals;
create trigger on_goal_completed
  after update of completed on goals
  for each row
  execute function notify_goal_completed();

-- ---------------------------------------------------------------------------
-- Points and achievements (unlocked titles) on the profile.
-- ---------------------------------------------------------------------------
create or replace function notify_profile_rewards()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gained integer;
  t text;
begin
  gained := coalesce(new.points, 0) - coalesce(old.points, 0);
  if gained > 0 then
    insert into notifications (user_id, actor_id, type, target_type, target_id, message)
    values (new.id, null, 'points', 'profile', new.id,
            'You earned ' || gained || ' point' || case when gained = 1 then '' else 's' end
            || ' · balance ' || new.points);
  end if;

  for t in
    select unnest(coalesce(new.unlocked_titles, '{}'))
    except
    select unnest(coalesce(old.unlocked_titles, '{}'))
  loop
    insert into notifications (user_id, actor_id, type, target_type, target_id, message)
    values (new.id, null, 'achievement', 'profile', new.id,
            'Achievement unlocked: ' || initcap(replace(t, '_', ' ')));
  end loop;

  return new;
end;
$$;

drop trigger if exists on_profile_rewards on profiles;
create trigger on_profile_rewards
  after update of points, unlocked_titles on profiles
  for each row
  execute function notify_profile_rewards();

-- ---------------------------------------------------------------------------
-- Birthdays: once a day (local time), tell everyone whose birthday it is.
-- Runs hourly via pg_cron and does nothing until BIRTHDAY_NOTIFY_HOUR in
-- the company's timezone; the log makes repeat runs no-ops.
-- ---------------------------------------------------------------------------
create table if not exists birthday_notification_log (
  profile_id uuid not null references profiles(id) on delete cascade,
  birthday_on date not null,
  notified_at timestamptz not null default now(),
  primary key (profile_id, birthday_on)
);

alter table birthday_notification_log enable row level security;

create or replace function notify_todays_birthdays(tz text default 'Asia/Kuala_Lumpur', notify_hour integer default 8)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  local_now timestamp := now() at time zone tz;
  today date := local_now::date;
  leap boolean := (make_date(extract(year from local_now)::int, 3, 1) - make_date(extract(year from local_now)::int, 2, 28)) = 2;
  person record;
  sent integer := 0;
begin
  if extract(hour from local_now) < notify_hour then
    return 0;
  end if;

  for person in
    select p.id, p.username
    from profiles p
    where p.birthday is not null
      and coalesce(p.is_deleted, false) = false
      and (
        (extract(month from p.birthday) = extract(month from today) and extract(day from p.birthday) = extract(day from today))
        -- 29 Feb birthdays are celebrated on 28 Feb in non-leap years.
        or (not leap and extract(month from p.birthday) = 2 and extract(day from p.birthday) = 29
            and extract(month from today) = 2 and extract(day from today) = 28)
      )
  loop
    insert into birthday_notification_log (profile_id, birthday_on) values (person.id, today)
    on conflict do nothing;
    if not found then
      continue;
    end if;

    insert into notifications (user_id, actor_id, type, target_type, target_id, message)
    select r.id, person.id, 'birthday', 'birthday', person.id,
           case when r.id = person.id
                then 'Happy birthday! 🎂 The whole team is celebrating you today'
                else 'It''s ' || coalesce('@' || person.username, 'a teammate') || '''s birthday today 🎂 Send them a wish!'
           end
    from profiles r
    where coalesce(r.is_deleted, false) = false;

    sent := sent + 1;
  end loop;
  return sent;
end;
$$;

revoke all on function notify_todays_birthdays(text, integer) from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'birthday-notifications') then
    perform cron.unschedule('birthday-notifications');
  end if;
  perform cron.schedule('birthday-notifications', '5 * * * *', 'select notify_todays_birthdays()');
exception when others then
  raise warning 'pg_cron unavailable, birthday notifications not scheduled: %', sqlerrm;
end;
$$;
