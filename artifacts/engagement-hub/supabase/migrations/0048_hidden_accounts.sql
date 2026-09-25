-- Hidden accounts (e.g. admin or test accounts): still active and can sign in,
-- but other people don't see them. profiles.is_hidden and the select policy
-- that hides them already exist; this adds the admin switch and keeps hidden
-- people's birthdays out of the team announcements.

alter table profiles add column if not exists is_hidden boolean not null default false;

create or replace function admin_set_hidden(target_user uuid, hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not viewer_is_admin() then raise exception 'Only admins can hide accounts.'; end if;
  update profiles set is_hidden = hidden where id = target_user;
  if not found then raise exception 'User not found.'; end if;
end;
$$;
grant execute on function admin_set_hidden(uuid, boolean) to authenticated;

create or replace function notify_todays_birthdays(tz text DEFAULT 'Asia/Kuala_Lumpur'::text, notify_hour integer DEFAULT 8) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
      and coalesce(p.is_hidden, false) = false
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
