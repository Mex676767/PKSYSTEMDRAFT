--
-- PostgreSQL database dump
--

\restrict ZNGcg2LSqIekA2icUsJqFvwvpUoIxNGp2gtPl3aNMZ7sJ5PO0YSjvZjyIG5sbSa

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: admin_adjust_points(uuid, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_adjust_points(target_user uuid, amount integer, reason text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    badges text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    username text,
    current_streak integer DEFAULT 0 NOT NULL,
    longest_streak integer DEFAULT 0 NOT NULL,
    last_login_date date,
    active_title text,
    unlocked_titles text[] DEFAULT '{}'::text[] NOT NULL,
    active_accessory text,
    unlocked_accessories text[] DEFAULT '{}'::text[] NOT NULL,
    is_admin boolean DEFAULT false NOT NULL,
    permissions text[] DEFAULT '{}'::text[] NOT NULL,
    department text,
    is_deleted boolean DEFAULT false NOT NULL,
    birthday date,
    role text,
    avatar_url text,
    unlocked_borders text[] DEFAULT '{}'::text[] NOT NULL,
    active_border text,
    is_hidden boolean DEFAULT false NOT NULL,
    last_seen_at timestamp with time zone,
    CONSTRAINT username_format CHECK (((username IS NULL) OR (username ~ '^[a-zA-Z0-9_]{3,20}$'::text)))
);


--
-- Name: admin_list_profiles(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_list_profiles() RETURNS SETOF public.profiles
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.viewer_is_admin() then
    raise exception 'Not authorized';
  end if;
  return query select * from public.profiles order by username;
end;
$$;


--
-- Name: admin_org_delete(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_org_delete(kind text, item_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  in_use integer;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then raise exception 'Not authorized'; end if;
  in_use := case when kind = 'role' then (select count(*) from profiles where role = item_name)
                 else (select count(*) from profiles where department = item_name) end;
  if in_use > 0 then
    raise exception '% still % "%". Reassign them first.', in_use, case when in_use = 1 then 'person has' else 'people have' end, item_name;
  end if;
  if kind = 'role' then delete from org_roles where name = item_name;
  else delete from org_departments where name = item_name; end if;
end;
$$;


--
-- Name: admin_org_move(text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_org_move(kind text, item_name text, direction integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  mine integer;
  other_name text;
  other integer;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then raise exception 'Not authorized'; end if;
  if kind = 'role' then
    mine := (select rank from org_roles where name = item_name);
    other_name := (select name from org_roles where case when direction < 0 then rank < mine else rank > mine end
                   order by case when direction < 0 then -rank else rank end limit 1);
    if mine is null or other_name is null then return; end if;
    other := (select rank from org_roles where name = other_name);
    update org_roles set rank = case when name = item_name then other else mine end where name in (item_name, other_name);
  else
    mine := (select sort from org_departments where name = item_name);
    other_name := (select name from org_departments where case when direction < 0 then sort < mine else sort > mine end
                   order by case when direction < 0 then -sort else sort end limit 1);
    if mine is null or other_name is null then return; end if;
    other := (select sort from org_departments where name = other_name);
    update org_departments set sort = case when name = item_name then other else mine end where name in (item_name, other_name);
  end if;
end;
$$;


--
-- Name: admin_org_save(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_org_save(kind text, old_name text, new_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  clean text := upper(trim(new_name));
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then raise exception 'Not authorized'; end if;
  if kind not in ('role', 'department') then raise exception 'Unknown kind'; end if;
  if clean is null or clean = '' then raise exception 'Name is required'; end if;
  if old_name is not null and old_name = clean then return; end if;
  if (kind = 'role' and exists (select 1 from org_roles where name = clean))
     or (kind = 'department' and exists (select 1 from org_departments where name = clean)) then
    raise exception '"%" already exists', clean;
  end if;

  if old_name is null then
    if kind = 'role' then
      insert into org_roles (name, rank) values (clean, coalesce((select max(rank) from org_roles), 0) + 1);
    else
      insert into org_departments (name, sort) values (clean, coalesce((select max(sort) from org_departments), 0) + 1);
    end if;
    return;
  end if;

  perform set_config('app.role_admin_override', 'true', true);
  if kind = 'role' then
    update org_roles set name = clean where name = old_name;
    if not found then raise exception 'Role not found'; end if;
    update profiles set role = clean where role = old_name;
  else
    update org_departments set name = clean where name = old_name;
    if not found then raise exception 'Department not found'; end if;
    update profiles set department = clean where department = old_name;
    if to_regclass('public.hof_award_categories') is not null then
      update hof_award_categories set department = clean where department = old_name;
    end if;
  end if;
end;
$$;


--
-- Name: admin_review_mission_claim(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_review_mission_claim(claim_id_param uuid, approve boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  c mission_claims := (select x from mission_claims x where x.id = claim_id_param);
  title text;
begin
  if not is_points_admin() then raise exception 'Not authorized'; end if;
  if c.id is null or c.status <> 'pending' then raise exception 'Nothing to review'; end if;
  title := coalesce((select x.title from missions x where x.id = c.mission_id), 'mission');

  update mission_claims
  set status = case when approve then 'awarded' else 'rejected' end, reviewed_by = auth.uid(), reviewed_at = now()
  where id = c.id;

  if approve then
    perform points_ledger_add(c.user_id, c.points, 'Mission: ' || title);
    insert into notifications (user_id, actor_id, type, target_type, target_id, message)
    values (c.user_id, auth.uid(), 'points', 'rewards', c.mission_id, 'Mission approved: ' || title || ' · +' || c.points || ' pts');
  else
    insert into notifications (user_id, actor_id, type, target_type, target_id, message)
    values (c.user_id, auth.uid(), 'points', 'rewards', c.mission_id, 'Mission not approved: ' || title || '. You can submit it again.');
  end if;
end;
$$;


--
-- Name: admin_review_redemption(uuid, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_review_redemption(redemption_id_param uuid, approve boolean, note text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  d reward_redemptions := (select x from reward_redemptions x where x.id = redemption_id_param);
begin
  if not is_points_admin() then raise exception 'Not authorized'; end if;
  if d.id is null or d.status <> 'pending' then raise exception 'Nothing to review'; end if;

  update reward_redemptions
  set status = case when approve then 'fulfilled' else 'rejected' end,
      admin_note = nullif(trim(note), ''), reviewed_by = auth.uid(), reviewed_at = now()
  where id = d.id;

  if approve then
    insert into notifications (user_id, actor_id, type, target_type, target_id, message)
    values (d.user_id, auth.uid(), 'points', 'rewards', d.id,
            'Your reward "' || d.reward_name || '" was approved 🎁' || coalesce(' · ' || nullif(trim(note), ''), ''));
  else
    perform points_ledger_add(d.user_id, d.cost, 'Refund: ' || d.reward_name);
    update rewards set stock = stock + 1 where id = d.reward_id and stock is not null;
    insert into notifications (user_id, actor_id, type, target_type, target_id, message)
    values (d.user_id, auth.uid(), 'points', 'rewards', d.id,
            'Your reward "' || d.reward_name || '" was declined · ' || d.cost || ' pts refunded'
            || coalesce(' · ' || nullif(trim(note), ''), ''));
  end if;
end;
$$;


--
-- Name: admin_set_achievement(uuid, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_achievement(target_user uuid, achievement_key text, has_it boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: admin_set_birthday(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_birthday(user_id_param uuid, birthday_param date) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Not authorized';
  end if;
  perform set_config('app.birthday_admin_override', 'true', true);
  update public.profiles set birthday = birthday_param where id = user_id_param;
end;
$$;


--
-- Name: admin_set_role_department(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_role_department(user_id_param uuid, role_param text, department_param text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Not authorized';
  end if;
  if role_param is not null and not exists (select 1 from org_roles where name = role_param) then
    raise exception 'Invalid role';
  end if;
  if department_param is not null and not exists (select 1 from org_departments where name = department_param) then
    raise exception 'Invalid department';
  end if;
  perform set_config('app.role_admin_override', 'true', true);
  update public.profiles set role = role_param, department = department_param where id = user_id_param;
end;
$$;


--
-- Name: admin_set_username(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_username(target_user uuid, new_username text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Not authorized';
  end if;
  if new_username is null or new_username !~ '^[a-zA-Z0-9_]{3,20}$' then
    raise exception 'Username must be 3-20 characters: letters, numbers, or underscore only.';
  end if;

  update public.profiles set username = new_username where id = target_user;
end;
$_$;


--
-- Name: apply_point_transaction(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_point_transaction() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public.profiles set points = points + new.amount where id = new.user_id;
  return new;
end;
$$;


--
-- Name: award_goal_completion_points(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_goal_completion_points() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  reward integer;
  completed_count integer;
begin
  if new.completed and not old.completed then
    reward := case new.term
      when 'long' then 100
      when 'mid' then 40
      else 15
    end;
    insert into public.point_transactions (user_id, amount, reason)
    values (new.owner_id, reward, 'Completed goal: ' || new.title);

    perform public.award_title(new.owner_id, 'goal_getter');

    select count(*) into completed_count
    from public.goals where owner_id = new.owner_id and completed = true;

    if completed_count >= 5 then
      perform public.award_title(new.owner_id, 'overachiever');
    end if;
  end if;
  return new;
end;
$$;


--
-- Name: award_hof_record_points(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_hof_record_points() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.is_current then
    insert into public.point_transactions (user_id, amount, reason)
    values (new.holder_id, 25, 'New Hall of Fame record');
    perform public.award_title(new.holder_id, 'record_holder');
  end if;
  return new;
end;
$$;


--
-- Name: award_title(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_title(target_user uuid, title_key text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public.profiles
  set unlocked_titles = array_append(unlocked_titles, title_key)
  where id = target_user
    and not (title_key = any(unlocked_titles));
end;
$$;


--
-- Name: birthday_email_settings_stamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.birthday_email_settings_stamp() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: cancel_bet(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_bet(bet_id_param uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  bet_status text;
  bet_creator uuid;
  wager record;
begin
  select status, creator_id into bet_status, bet_creator from public.bets where id = bet_id_param;
  if bet_status is distinct from 'open' then
    raise exception 'Bet is not open';
  end if;
  if not (public.has_permission('manage_bets') or bet_creator = auth.uid()) then
    raise exception 'Not authorized';
  end if;

  for wager in select * from public.bet_wagers where bet_id = bet_id_param loop
    insert into public.point_transactions (user_id, amount, reason)
    values (wager.user_id, wager.amount, 'Bet cancelled (refund)');
  end loop;

  update public.bets set status = 'cancelled' where id = bet_id_param;
end;
$$;


--
-- Name: cancel_challenge(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_challenge(challenge_id_param uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  c record;
begin
  select * into c from public.challenges where id = challenge_id_param;
  if c is null then
    raise exception 'Challenge not found';
  end if;
  if auth.uid() not in (c.creator_id, c.opponent_id) then
    raise exception 'Not authorized';
  end if;
  if c.status <> 'pending' then
    raise exception 'Only a pending challenge can be cancelled';
  end if;

  update public.challenges set status = 'declined' where id = challenge_id_param;
end;
$$;


--
-- Name: claim_daily_login_bonus(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_daily_login_bonus() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: claim_mission(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_mission(mission_id_param uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  uid uuid := auth.uid();
  tz text := (select timezone from points_settings where id = 1);
  m missions := (select x from missions x where x.id = mission_id_param);
  ps date;
  ws timestamptz;
  we timestamptz;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if not coalesce((select revamp_enabled from points_settings where id = 1), false) then
    raise exception 'Missions are turned off';
  end if;
  if m.id is null or not m.active then raise exception 'Mission not available'; end if;

  ps := (select w.period_start from mission_window(m.cadence, m.starts_at, m.ends_at, tz) w);
  ws := (select w.win_start from mission_window(m.cadence, m.starts_at, m.ends_at, tz) w);
  we := (select w.win_end from mission_window(m.cadence, m.starts_at, m.ends_at, tz) w);
  if now() < ws or now() >= we then raise exception 'This mission isn''t running right now'; end if;

  if m.kind = 'manual' then
    insert into mission_claims (mission_id, user_id, period_start, status, points)
    values (m.id, uid, ps, 'pending', m.points)
    on conflict (mission_id, user_id, period_start) do update
      set status = 'pending', created_at = now(), reviewed_by = null, reviewed_at = null
      where mission_claims.status = 'rejected';
    if not found then raise exception 'Already submitted'; end if;
    return 'pending';
  end if;

  if mission_progress(uid, m.kind, ws, we, tz) < m.target_count then
    raise exception 'Not finished yet';
  end if;
  insert into mission_claims (mission_id, user_id, period_start, status, points)
  values (m.id, uid, ps, 'awarded', m.points)
  on conflict (mission_id, user_id, period_start) do nothing;
  if not found then raise exception 'Already claimed'; end if;

  perform points_ledger_add(uid, m.points, 'Mission: ' || m.title);
  insert into notifications (user_id, type, target_type, target_id, message)
  values (uid, 'points', 'rewards', m.id, 'Mission complete: ' || m.title || ' · +' || m.points || ' pts');
  return 'awarded';
end;
$$;


--
-- Name: complete_challenge(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_challenge(challenge_id_param uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  c record;
  winner uuid;
begin
  select * into c from public.challenges where id = challenge_id_param;
  if c is null then
    raise exception 'Challenge not found';
  end if;
  if auth.uid() not in (c.creator_id, c.opponent_id) then
    raise exception 'Not authorized';
  end if;
  if c.status <> 'active' then
    raise exception 'Challenge is not active';
  end if;

  if c.score_creator > c.score_opponent then
    winner := c.creator_id;
  elsif c.score_opponent > c.score_creator then
    winner := c.opponent_id;
  else
    winner := null; -- tie
  end if;

  update public.challenges set status = 'completed', winner_id = winner where id = challenge_id_param;
end;
$$;


--
-- Name: create_bet(text, text[], timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_bet(title_param text, options_param text[], closes_at_param timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  new_bet_id uuid;
  opt text;
begin
  if title_param is null or length(trim(title_param)) = 0 then
    raise exception 'Title is required';
  end if;
  if array_length(options_param, 1) is null or array_length(options_param, 1) < 2 then
    raise exception 'A bet needs at least 2 options';
  end if;

  insert into public.bets (creator_id, title, closes_at)
  values (auth.uid(), trim(title_param), closes_at_param)
  returning id into new_bet_id;

  foreach opt in array options_param loop
    if length(trim(opt)) > 0 then
      insert into public.bet_options (bet_id, label) values (new_bet_id, trim(opt));
    end if;
  end loop;

  return new_bet_id;
end;
$$;


--
-- Name: create_challenge(uuid, text, text, text, text, timestamp with time zone, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_challenge(opponent_id_param uuid, topic_param text, description_param text, reward_param text, punishment_param text, ends_at_param timestamp with time zone, metric_param text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  raise exception 'Challenges moved to the PK Arena. Refresh the page to start a PK.';
end;
$$;


--
-- Name: deactivate_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.deactivate_user(target_user uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  target_is_admin boolean;
begin
  if not public.has_permission('manage_users') then
    raise exception 'Not authorized';
  end if;
  if target_user = auth.uid() then
    raise exception 'Use delete_own_account() to remove your own account';
  end if;

  select is_admin into target_is_admin from public.profiles where id = target_user;
  if target_is_admin and not public.is_admin() then
    raise exception 'Only admins can deactivate another admin';
  end if;

  update public.profiles set is_deleted = true where id = target_user;
end;
$$;


--
-- Name: delete_challenge(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_challenge(challenge_id_param uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  c record;
  is_admin_user boolean;
begin
  select * into c from public.challenges where id = challenge_id_param;
  if c is null then
    raise exception 'Challenge not found';
  end if;

  select is_admin into is_admin_user from public.profiles where id = auth.uid();
  if not (coalesce(is_admin_user, false) or c.creator_id = auth.uid()) then
    raise exception 'Not authorized';
  end if;

  if c.status not in ('declined', 'completed') then
    raise exception 'Only a finished challenge can be deleted -- cancel or complete it first';
  end if;

  delete from public.challenges where id = challenge_id_param;
end;
$$;


--
-- Name: delete_own_account(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_own_account() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public.profiles set is_deleted = true where id = auth.uid();
end;
$$;


--
-- Name: end_my_session(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.end_my_session() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update login_sessions
  set ended_at = now()
  where user_id = auth.uid() and ended_at is null;
end;
$$;


--
-- Name: get_my_missions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_missions() RETURNS TABLE(id uuid, title text, description text, cadence text, kind text, target_count integer, points integer, starts_at timestamp with time zone, ends_at timestamp with time zone, progress integer, claim_status text, resets_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: get_or_create_dm_conversation(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_or_create_dm_conversation(other_user_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  lo uuid;
  hi uuid;
  convo_id uuid;
begin
  if other_user_id = auth.uid() then
    raise exception 'Cannot message yourself';
  end if;
  if not exists (select 1 from public.profiles where id = other_user_id and not is_deleted) then
    raise exception 'User not found';
  end if;

  if auth.uid() < other_user_id then
    lo := auth.uid(); hi := other_user_id;
  else
    lo := other_user_id; hi := auth.uid();
  end if;

  select id into convo_id from public.dm_conversations where user_a = lo and user_b = hi;
  if convo_id is null then
    insert into public.dm_conversations (user_a, user_b) values (lo, hi) returning id into convo_id;
  end if;

  return convo_id;
end;
$$;


--
-- Name: get_quiz_leaderboard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_quiz_leaderboard() RETURNS TABLE(user_id uuid, username text, correct_count bigint, total_answered bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select qa.user_id, p.username,
         count(*) filter (where qa.correct) as correct_count,
         count(*) as total_answered
  from public.quiz_answers qa
  join public.profiles p on p.id = qa.user_id
  group by qa.user_id, p.username
  order by correct_count desc;
$$;


--
-- Name: get_quiz_questions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_quiz_questions() RETURNS TABLE(id uuid, question text, options text[])
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select id, question, options from public.quiz_questions order by created_at;
$$;


--
-- Name: get_target_owner(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_target_owner(target_type_param text, target_id_param text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  owner uuid;
begin
  if target_type_param = 'goal' then
    select owner_id into owner from public.goals where id = target_id_param::uuid;
  elsif target_type_param = 'birthday' then
    owner := target_id_param::uuid; -- a birthday's target_id IS the profile id
  elsif target_type_param = 'post' then
    select author_id into owner from public.posts where id = target_id_param::uuid;
  elsif target_type_param = 'hof_record' then
    select holder_id into owner from public.hof_records where id = target_id_param::uuid;
  end if;
  return owner;
exception when others then
  return null; -- malformed id or unknown type -- just skip notifying
end;
$$;


--
-- Name: gift_points(uuid, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gift_points(recipient_id uuid, amount integer, note text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  sender_points integer;
begin
  if amount <= 0 then
    raise exception 'Amount must be positive';
  end if;
  if recipient_id = auth.uid() then
    raise exception 'Cannot gift points to yourself';
  end if;

  select points into sender_points from public.profiles where id = auth.uid();
  if sender_points is null or sender_points < amount then
    raise exception 'Not enough points';
  end if;

  insert into public.point_transactions (user_id, amount, reason)
  values (auth.uid(), -amount, coalesce('Gift sent: ' || note, 'Gift sent'));
  insert into public.point_transactions (user_id, amount, reason)
  values (recipient_id, amount, coalesce('Gift received: ' || note, 'Gift received'));

  perform public.award_title(auth.uid(), 'philanthropist');
end;
$$;


--
-- Name: guard_point_transaction(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_point_transaction() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  return new;
end;
$$;


--
-- Name: has_permission(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_permission(perm text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(
    (select is_admin or perm = any(permissions) from public.profiles where id = auth.uid()),
    false
  );
$$;


--
-- Name: hof_audit_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hof_audit_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: hof_can_manage(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hof_can_manage(permission_name text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ select exists(select 1 from public.profiles where id = auth.uid() and is_deleted = false and (is_admin = true or permission_name = any(permissions))); $$;


--
-- Name: hof_delete_category(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hof_delete_category(target_category uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
 if not public.hof_can_manage('manage_hall_of_fame') then raise exception 'Only administrators or Guinness Records managers can delete categories.' using errcode = '42501'; end if;
 perform 1 from public.hof_categories where id = target_category for update;
 if not found then raise exception 'This category no longer exists.'; end if;
 delete from public.hof_records where category_id = target_category;
 delete from public.hof_categories where id = target_category;
end; $$;


--
-- Name: hof_delete_record(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hof_delete_record(target_record uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
 if not public.hof_can_manage('manage_hall_of_fame') then raise exception 'Only administrators or Guinness Records managers can delete records.' using errcode = '42501'; end if;
 delete from public.hof_records where id = target_record;
 if not found then raise exception 'This record no longer exists.'; end if;
end; $$;


--
-- Name: hof_save_winners(uuid, date, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hof_save_winners(target_category uuid, target_month date, winners jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;


--
-- Name: is_points_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_points_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from profiles where id = auth.uid() and is_admin = true);
$$;


--
-- Name: join_voice_session(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.join_voice_session(p_channel_id text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update voice_sessions set left_at = now() where user_id = auth.uid() and left_at is null;
  insert into voice_sessions (user_id, channel_id) values (auth.uid(), p_channel_id);
end;
$$;


--
-- Name: leave_voice_session(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.leave_voice_session() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update voice_sessions set left_at = now() where user_id = auth.uid() and left_at is null;
end;
$$;


--
-- Name: log_mission_activity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_mission_activity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  kind text := tg_argv[0];
  row_new jsonb := to_jsonb(new);
  row_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  uid uuid;
  ref text;
begin
  begin
    uid := nullif(row_new ->> tg_argv[1], '')::uuid;
    ref := coalesce(row_new ->> nullif(tg_argv[2], ''), row_new ->> 'id');
    if uid is null then
      return new;
    end if;
    if kind = 'birthday_wish' and coalesce(row_new ->> 'target_type', '') <> 'birthday' then
      return new;
    end if;
    if kind = 'quiz_correct' and coalesce((row_new ->> 'correct')::boolean, false) = false then
      return new;
    end if;
    if kind in ('goal_complete', 'wordle_solve') then
      if coalesce((row_new ->> case when kind = 'goal_complete' then 'completed' else 'solved' end)::boolean, false) = false
         or coalesce((row_old ->> case when kind = 'goal_complete' then 'completed' else 'solved' end)::boolean, false) = true then
        return new;
      end if;
    end if;
    insert into mission_activity (user_id, kind, ref_id) values (uid, kind, ref);
  exception when others then
    raise warning 'log_mission_activity(%): %', kind, sqlerrm;
  end;
  return new;
end;
$$;


--
-- Name: mark_dm_read(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_dm_read(conversation_id_param uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public.direct_messages
  set read_at = now()
  where conversation_id = conversation_id_param
    and sender_id <> auth.uid()
    and read_at is null
    and exists (
      select 1 from public.dm_conversations c
      where c.id = conversation_id_param and auth.uid() in (c.user_a, c.user_b)
    );
end;
$$;


--
-- Name: mission_progress(uuid, text, timestamp with time zone, timestamp with time zone, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mission_progress(uid uuid, kind text, win_start timestamp with time zone, win_end timestamp with time zone, tz text) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: mission_window(text, timestamp with time zone, timestamp with time zone, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mission_window(cadence text, starts_at timestamp with time zone, ends_at timestamp with time zone, tz text) RETURNS TABLE(period_start date, win_start timestamp with time zone, win_end timestamp with time zone)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
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


--
-- Name: notify_comment_reply(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_comment_reply() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  parent_author uuid;
  replier_username text;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  parent_author := (select author_id from comments where id = new.parent_comment_id);
  if parent_author is null or parent_author = new.author_id then
    return new;
  end if;

  replier_username := (select username from profiles where id = new.author_id);

  insert into notifications (user_id, actor_id, type, target_type, target_id, message)
  values (
    parent_author,
    new.author_id,
    'comment',
    new.target_type,
    new.target_id,
    coalesce('@' || replier_username, 'Someone') || ' replied to your comment'
  );

  return new;
end;
$$;


--
-- Name: notify_goal_completed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_goal_completed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.completed and not coalesce(old.completed, false) then
    insert into notifications (user_id, actor_id, type, target_type, target_id, message)
    values (new.owner_id, null, 'goal', 'goal', new.id, 'You completed your goal "' || left(new.title, 80) || '" 🎉');
  end if;
  return new;
end;
$$;


--
-- Name: notify_on_comment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_on_comment() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  owner uuid;
  actor_username text;
begin
  owner := public.get_target_owner(new.target_type, new.target_id);
  if owner is null or owner = new.author_id then
    return new; -- no resolvable owner, or commenting on your own thing
  end if;

  select username into actor_username from public.profiles where id = new.author_id;

  insert into public.notifications (user_id, actor_id, type, target_type, target_id, message)
  values (owner, new.author_id, 'comment', new.target_type, new.target_id,
          coalesce('@' || actor_username, 'Someone') || ' commented on your ' || new.target_type);

  return new;
end;
$$;


--
-- Name: notify_on_reaction(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_on_reaction() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  owner uuid;
  actor_username text;
begin
  owner := public.get_target_owner(new.target_type, new.target_id);
  if owner is null or owner = new.user_id then
    return new;
  end if;

  select username into actor_username from public.profiles where id = new.user_id;

  insert into public.notifications (user_id, actor_id, type, target_type, target_id, message)
  values (owner, new.user_id, 'reaction', new.target_type, new.target_id,
          coalesce('@' || actor_username, 'Someone') || ' reacted ' || new.emoji || ' to your ' || new.target_type);

  return new;
end;
$$;


--
-- Name: notify_profile_rewards(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_profile_rewards() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: notify_todays_birthdays(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_todays_birthdays(tz text DEFAULT 'Asia/Kuala_Lumpur'::text, notify_hour integer DEFAULT 8) RETURNS integer
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


--
-- Name: pk_accept_open(uuid, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_accept_open(cid uuid, my_baseline numeric DEFAULT NULL::numeric, my_target numeric DEFAULT NULL::numeric) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  uid uuid := auth.uid();
  c challenges := (select x from challenges x where x.id = cid for update);
begin
  if c.id is null or c.pk_version <> 1 or c.method <> 'open' then raise exception 'Open challenge not found.'; end if;
  if c.status <> 'awaiting_opponent' or c.opponent_id is not null then raise exception 'Someone has already taken this challenge.'; end if;
  if c.expires_at is not null and c.expires_at <= now() then
    update challenges set status = 'expired' where id = cid;
    raise exception 'This open challenge has expired.';
  end if;
  if uid = c.creator_id then raise exception 'You can''t accept your own challenge.'; end if;

  insert into challenge_participants (challenge_id, user_id, side, is_captain, accepted_at, baseline, target)
  values (cid, uid, 'B', true, now(), my_baseline, my_target);
  update challenges
  set opponent_id = uid,
      pk_type = case when pk_rank_of(uid) <> pk_rank_of(creator_id) then 'vs_upline' else 'one_v_one' end,
      expires_at = null
  where id = cid;

  perform pk_check_terms(cid);
  perform pk_check_participant(cid, uid);
  perform pk_check_participant(cid, c.creator_id);
  perform pk_record_terms(cid, 'accepted_open');
  perform pk_log(cid, 'accepted', pk_me() || ' took the open challenge.');
  perform pk_notify(cid, array[c.creator_id], pk_me() || ' accepted your open challenge: ' || c.topic);
  perform pk_all_accepted(cid);
end;
$$;


--
-- Name: pk_all_accepted(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_all_accepted(cid uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if exists (select 1 from challenge_participants where challenge_id = cid and accepted_at is null) then return; end if;
  update challenges set status = 'awaiting_approval' where id = cid;
  perform pk_record_terms(cid, 'agreed');
  perform pk_log(cid, 'agreed', 'Everyone agreed to the terms. Waiting for approval.');
  perform pk_notify(cid, array(select pk_approver_ids(cid)),
    'A PK needs your approval: ' || (select topic from challenges where id = cid));
end;
$$;


--
-- Name: pk_approver_ids(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_approver_ids(cid uuid) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with eligible as (
    select p.id from profiles p
    where not p.is_admin and coalesce(p.is_deleted, false) = false and pk_can_approve(cid, p.id))
  select id from eligible
  union all
  select p.id from profiles p where p.is_admin and coalesce(p.is_deleted, false) = false and not exists (select 1 from eligible);
$$;


--
-- Name: pk_auto_settle(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_auto_settle() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  r record;
  n integer := 0;
begin
  for r in select id from challenges where pk_version = 1 and status = 'active' and ends_at < now() - interval '2 days' loop
    perform pk_settle_start(r.id, false, null);
    n := n + 1;
  end loop;
  return n;
end;
$$;


--
-- Name: pk_can_approve(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_can_approve(cid uuid, user_id_param uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select case
    when exists (select 1 from profiles where id = user_id_param and is_admin) then true
    when exists (select 1 from challenge_participants where challenge_id = cid and user_id = user_id_param) then false
    else coalesce((
      select pr.department = c.department and coalesce(pr.is_deleted, false) = false
             and pk_rank_of(user_id_param) <= least(m.top - 1, coalesce(pk_role_rank('ATL'), m.top - 1))
      from challenges c
      cross join (select min(pk_rank_of(user_id)) as top from challenge_participants where challenge_id = cid) m
      join profiles pr on pr.id = user_id_param
      where c.id = cid), false)
  end;
$$;


--
-- Name: pk_cancel(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_cancel(cid uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  c challenges := (select x from challenges x where x.id = cid);
begin
  if c.id is null or c.pk_version <> 1 then raise exception 'PK not found.'; end if;
  if auth.uid() <> c.creator_id and not viewer_is_admin() then raise exception 'Only the person who issued it can cancel it.'; end if;
  if c.status not in ('awaiting_opponent', 'countered', 'awaiting_approval') then
    raise exception 'Only a PK that hasn''t been approved yet can be cancelled.';
  end if;
  update challenges set status = 'cancelled' where id = cid;
  perform pk_log(cid, 'cancelled', pk_me() || ' cancelled the challenge.');
  perform pk_notify(cid, array(select user_id from challenge_participants where challenge_id = cid), pk_me() || ' cancelled the PK: ' || c.topic);
end;
$$;


--
-- Name: pk_champions(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_champions(dept text DEFAULT NULL::text) RETURNS TABLE(period_start date, department text, user_id uuid, username text, avatar_url text, active_border text, active_accessory text, points numeric, wins integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with totals as (
    select p.period_start, p.department, p.user_id, sum(p.points) as points,
      count(*) filter (where p.outcome = 'win')::int as wins
    from pk_points p where dept is null or p.department = dept
    group by p.period_start, p.department, p.user_id),
  ranked as (
    select t.*, rank() over (partition by t.period_start, t.department order by t.points desc) as r from totals t)
  select r.period_start, r.department, r.user_id, pr.username, pr.avatar_url, pr.active_border, pr.active_accessory, r.points, r.wins
  from ranked r join profiles pr on pr.id = r.user_id
  where r.r = 1 and r.points > 0
  order by r.period_start desc, r.department, pr.username;
$$;


--
-- Name: pk_check_participant(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_check_participant(cid uuid, user_id_param uuid) RETURNS void
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  c challenges := (select x from challenges x where x.id = cid);
  s pk_settings := (select x from pk_settings x where x.id = 1);
  who text := coalesce('@' || (select username from profiles where id = user_id_param), 'Someone');
  live text[] := array['awaiting_approval', 'active', 'settlement_requested', 'awaiting_playbook', 'awaiting_verification'];
  total integer;
  same_type integer;
  used numeric;
  allowance numeric := pk_money_limit(user_id_param);
begin
  if (select department from profiles where id = user_id_param) is distinct from c.department then
    raise exception '% isn''t in %. PKs are within one department for now.', who, c.department;
  end if;
  total := (select count(*) from challenges x join challenge_participants p on p.challenge_id = x.id
            where p.user_id = user_id_param and x.pk_version = 1 and x.status = any(live) and x.id <> cid);
  same_type := (select count(*) from challenges x join challenge_participants p on p.challenge_id = x.id
                where p.user_id = user_id_param and x.pk_version = 1 and x.status = any(live) and x.id <> cid and x.pk_type = c.pk_type);
  if total >= s.max_total then
    raise exception '% already has % PKs going (the most is %).', who, total, s.max_total;
  end if;
  if (c.pk_type = 'one_v_one' and same_type >= s.max_one_v_one) or (c.pk_type = 'team' and same_type >= s.max_team)
     or (c.pk_type = 'vs_upline' and same_type >= s.max_vs_upline) then
    raise exception '% already has the most % PKs allowed at once (%).', who,
      case c.pk_type when 'one_v_one' then '1v1' when 'team' then 'team' else 'vs Upline' end,
      case c.pk_type when 'one_v_one' then s.max_one_v_one when 'team' then s.max_team else s.max_vs_upline end;
  end if;
  used := pk_money_used(user_id_param, date_trunc('month', c.starts_at at time zone 'Asia/Kuala_Lumpur')::date, cid);
  if c.pk_money > 0 and used + c.pk_money > allowance then
    raise exception 'USD % is over %''s PK Money allowance for that month (USD % of % used).', c.pk_money, who, used, allowance;
  end if;
end;
$$;


--
-- Name: pk_check_terms(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_check_terms(cid uuid) RETURNS void
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  c challenges := (select x from challenges x where x.id = cid);
  bad record;
  size_a integer := (select count(*) from challenge_participants where challenge_id = cid and side = 'A');
  size_b integer := (select count(*) from challenge_participants where challenge_id = cid and side = 'B');
begin
  if coalesce(trim(c.topic), '') = '' then raise exception 'Give the challenge a title.'; end if;
  if coalesce(trim(c.metric), '') = '' then raise exception 'Say what''s being measured.'; end if;
  if coalesce(trim(c.metric_definition), '') = '' then raise exception 'Explain exactly how the metric is counted.'; end if;
  if c.direction is null then raise exception 'Choose whether a higher or a lower number wins.'; end if;
  if c.format = 'head_to_head' and c.scoring is null then raise exception 'Choose how the winner is decided.'; end if;
  if coalesce(trim(c.proof_method), '') = '' then raise exception 'Say what counts as proof for score updates.'; end if;
  if c.ends_at <= c.starts_at then raise exception 'The end date has to be after the start date.'; end if;
  if c.ends_at <= now() then raise exception 'The end date has to be in the future.'; end if;
  if c.winning_target is not null and c.winning_target <= 0 then raise exception 'The winning target has to be above zero.'; end if;

  if c.format = 'self_declaration' and exists (
    select 1 from challenge_participants where challenge_id = cid and side = 'A' and (baseline is null or target is null)) then
    raise exception 'A self-declaration needs your current level and the target you''re declaring.';
  end if;
  if c.format = 'head_to_head' and c.scoring = 'improvement' and exists (
    select 1 from challenge_participants where challenge_id = cid and baseline is null) then
    raise exception 'Improvement scoring needs everyone''s starting baseline.';
  end if;
  if c.format = 'head_to_head' and c.scoring = 'completion' and exists (
    select 1 from challenge_participants where challenge_id = cid and target is null) then
    raise exception 'Completion rate scoring needs a target for everyone.';
  end if;

  -- Targets must represent improvement on the person's own baseline.
  for bad in
    select pr.username from challenge_participants p join profiles pr on pr.id = p.user_id
    where p.challenge_id = cid and p.baseline is not null and p.target is not null
      and ((c.direction = 'higher' and p.target <= p.baseline) or (c.direction = 'lower' and p.target >= p.baseline))
  loop
    raise exception 'Targets have to be an improvement: @%''s target must be % than their baseline.',
      bad.username, case when c.direction = 'higher' then 'higher' else 'lower' end;
  end loop;

  if c.pk_type = 'team' and (size_a < 2 or size_a > 5 or (size_b > 0 and size_b <> size_a)) then
    raise exception 'Team PKs need 2 to 5 people on each side, with the same number on both sides.';
  end if;
end;
$$;


--
-- Name: pk_create(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_create(terms jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  uid uuid := auth.uid();
  dept text := (select department from profiles where id = auth.uid());
  new_id uuid := gen_random_uuid();
  fmt text := coalesce(terms->>'format', 'head_to_head');
  mth text := coalesce(terms->>'method', 'named');
  is_team boolean := coalesce((terms->>'team')::boolean, false);
  s pk_settings := (select x from pk_settings x where x.id = 1);
  p jsonb;
  opp uuid;
begin
  if uid is null then raise exception 'Sign in first.'; end if;
  if dept is null then raise exception 'Set your department on your profile before starting a PK.'; end if;
  if not coalesce((terms->>'compliance_agreed')::boolean, false) then
    raise exception 'Please agree to the fair-play rules first.';
  end if;
  if mth not in ('named', 'open') or fmt not in ('head_to_head', 'self_declaration') then raise exception 'Unknown challenge type.'; end if;
  if is_team and (mth = 'open' or fmt = 'self_declaration') then
    raise exception 'Team PKs are head-to-head named challenges for now.';
  end if;

  insert into challenges (
    id, pk_version, creator_id, topic, description, metric, metric_definition, direction, scoring, format, method,
    pk_type, department, winning_target, starts_at, ends_at, update_frequency, reward, punishment, pk_money,
    proof_method, tiebreaker, compliance_agreed, status, expires_at)
  values (
    new_id, 1, uid, trim(terms->>'title'), nullif(trim(terms->>'description'), ''), trim(terms->>'metric'),
    nullif(trim(terms->>'metric_definition'), ''), terms->>'direction',
    case when fmt = 'self_declaration' then null else terms->>'scoring' end, fmt, mth,
    case when is_team then 'team' else 'one_v_one' end, dept, nullif(terms->>'winning_target', '')::numeric,
    coalesce(nullif(terms->>'starts_at', '')::timestamptz, now()), (terms->>'ends_at')::timestamptz,
    nullif(trim(terms->>'update_frequency'), ''), nullif(trim(terms->>'reward'), ''), nullif(trim(terms->>'punishment'), ''),
    coalesce(nullif(terms->>'pk_money', '')::numeric, 0), nullif(trim(terms->>'proof_method'), ''),
    nullif(trim(terms->>'tiebreaker'), ''), true, 'awaiting_opponent',
    case when mth = 'open' then now() + make_interval(days => s.open_expiry_days) end);

  insert into challenge_participants (challenge_id, user_id, side, is_captain, accepted_at, baseline, target)
  values (new_id, uid, 'A', true, now(), nullif(terms->'creator'->>'baseline', '')::numeric, nullif(terms->'creator'->>'target', '')::numeric);

  if mth = 'named' then
    for p in select * from jsonb_array_elements(coalesce(terms->'participants', '[]'::jsonb)) loop
      if (p->>'user_id')::uuid = uid then continue; end if;
      insert into challenge_participants (challenge_id, user_id, side, is_captain, baseline, target)
      values (new_id, (p->>'user_id')::uuid, coalesce(p->>'side', 'B'), coalesce((p->>'is_captain')::boolean, not is_team),
              nullif(p->>'baseline', '')::numeric, nullif(p->>'target', '')::numeric);
    end loop;
    if is_team and (select count(*) from challenge_participants where challenge_id = new_id and side = 'B' and is_captain) <> 1 then
      raise exception 'Pick one captain for the other team.';
    end if;
    opp := (select user_id from challenge_participants where challenge_id = new_id and side = 'B'
            order by is_captain desc limit 1);
    if opp is null then raise exception 'Choose who you''re challenging.'; end if;
    if not is_team and (select count(*) from challenge_participants where challenge_id = new_id) <> 2 then
      raise exception 'A 1v1 PK has exactly one opponent.';
    end if;
  end if;

  -- A 1v1 between different ranks counts as vs Upline (docs/PK-SYSTEM.md).
  update challenges
  set opponent_id = opp,
      pk_type = case when is_team then 'team'
                     when opp is not null and pk_rank_of(opp) <> pk_rank_of(uid) then 'vs_upline'
                     else 'one_v_one' end,
      winning_target = case when fmt = 'self_declaration'
                            then (select target from challenge_participants where challenge_id = new_id and user_id = uid)
                            else winning_target end
  where id = new_id;

  perform pk_check_terms(new_id);
  perform pk_check_participant(new_id, uid);
  if exists (select 1 from challenge_participants cp join profiles pr on pr.id = cp.user_id
             where cp.challenge_id = new_id and pr.department is distinct from dept) then
    raise exception 'Everyone has to be in your department (%).', dept;
  end if;

  perform pk_record_terms(new_id, 'proposed');
  perform pk_log(new_id, 'created', pk_me() || case when mth = 'open' then ' posted an open challenge' else ' issued the challenge' end);
  perform pk_notify(new_id,
    array(select user_id from challenge_participants where challenge_id = new_id and user_id <> uid),
    pk_me() || ' challenged you to a PK: ' || trim(terms->>'title'));
  return new_id;
end;
$$;


--
-- Name: pk_delete(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_delete(cid uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not viewer_is_admin() then raise exception 'Only an admin can remove a PK.'; end if;
  delete from challenges where id = cid and pk_version = 1;
end;
$$;


--
-- Name: pk_expire_open(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_expire_open() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  n integer;
begin
  with gone as (
    update challenges set status = 'expired'
    where pk_version = 1 and method = 'open' and status = 'awaiting_opponent' and expires_at <= now()
    returning id)
  insert into challenge_events (challenge_id, kind, message) select id, 'expired', 'Nobody accepted in time, so it expired.' from gone;
  get diagnostics n = row_count;
  return n;
end;
$$;


--
-- Name: pk_guard_legacy(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_guard_legacy() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if tg_op = 'DELETE' then
    if old.pk_version = 1 and not viewer_is_admin() then
      raise exception 'Only an admin can delete a PK.';
    end if;
    return old;
  end if;
  if old.pk_version = 1 and (new.score_creator is distinct from old.score_creator
      or new.score_opponent is distinct from old.score_opponent
      or new.status in ('pending', 'completed') or new.pk_version <> 1) then
    raise exception 'This is a PK. Use the PK Arena to update it.';
  end if;
  return new;
end;
$$;


--
-- Name: pk_leaderboard(date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_leaderboard(period date DEFAULT NULL::date, dept text DEFAULT NULL::text) RETURNS TABLE(user_id uuid, username text, role text, department text, avatar_url text, active_border text, active_accessory text, points numeric, wins integer, losses integer, draws integer, played integer, win_pct numeric, streak integer, rank integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with pts as (
    select * from pk_points
    where period_start = coalesce(period, pk_quarter(now())) and (dept is null or department = dept)),
  ordered as (
    select user_id, outcome, row_number() over (partition by user_id order by created_at desc) as rn from pts),
  streaks as (
    select user_id, coalesce(min(rn) filter (where outcome <> 'win'), max(rn) + 1) - 1 as streak from ordered group by user_id),
  agg as (
    select p.user_id, p.department, sum(p.points) as points,
      count(*) filter (where outcome = 'win')::int as wins,
      count(*) filter (where outcome = 'loss')::int as losses,
      count(*) filter (where outcome = 'draw')::int as draws,
      count(*)::int as played
    from pts p group by p.user_id, p.department)
  select a.user_id, pr.username, pr.role, a.department, pr.avatar_url, pr.active_border, pr.active_accessory,
    a.points, a.wins, a.losses, a.draws, a.played,
    round(100.0 * a.wins / nullif(a.played, 0), 0), s.streak::int,
    rank() over (partition by a.department order by a.points desc)::int
  from agg a join profiles pr on pr.id = a.user_id join streaks s on s.user_id = a.user_id
  where coalesce(pr.is_deleted, false) = false
  order by a.department, a.points desc, a.wins desc, pr.username;
$$;


--
-- Name: pk_log(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_log(cid uuid, kind_name text, message_text text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  insert into challenge_events (challenge_id, actor_id, kind, message) values (cid, auth.uid(), kind_name, message_text);
$$;


--
-- Name: pk_mark_paid(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_mark_paid(debt_id uuid, paid boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update pk_money_debts set paid_at = case when paid then now() end
  where id = debt_id and (creditor_id = auth.uid() or viewer_is_admin());
  if not found then raise exception 'Only the person who''s owed can mark this as received.'; end if;
end;
$$;


--
-- Name: pk_me(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_me() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce('@' || (select username from profiles where id = auth.uid()), 'Someone');
$$;


--
-- Name: pk_money_limit(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_money_limit(user_id_param uuid) RETURNS numeric
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select case
    when pk_role_rank('TL') is not null and pk_rank_of(user_id_param) < pk_role_rank('TL') then s.money_limit_above_tl
    when pk_rank_of(user_id_param) between least(pk_role_rank('TL'), pk_role_rank('ATL')) and greatest(pk_role_rank('TL'), pk_role_rank('ATL')) then s.money_limit_atl_tl
    else s.money_limit_default end
  from pk_settings s where s.id = 1;
$$;


--
-- Name: pk_money_summary(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_money_summary() RETURNS TABLE(month_start date, allowance numeric, used numeric, remaining numeric, owed_to_me numeric, i_owe numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with m as (select date_trunc('month', now() at time zone 'Asia/Kuala_Lumpur')::date as d)
  select m.d, pk_money_limit(auth.uid()), pk_money_used(auth.uid(), m.d),
    greatest(pk_money_limit(auth.uid()) - pk_money_used(auth.uid(), m.d), 0),
    coalesce((select sum(amount) from pk_money_debts where creditor_id = auth.uid() and paid_at is null), 0),
    coalesce((select sum(amount) from pk_money_debts where debtor_id = auth.uid() and paid_at is null), 0)
  from m;
$$;


--
-- Name: pk_money_used(uuid, date, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_money_used(user_id_param uuid, month_start date, exclude_id uuid DEFAULT NULL::uuid) RETURNS numeric
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(sum(c.pk_money), 0)
  from challenges c join challenge_participants p on p.challenge_id = c.id
  where p.user_id = user_id_param and c.pk_version = 1 and c.id is distinct from exclude_id
    and c.status in ('awaiting_approval', 'active', 'settlement_requested', 'awaiting_playbook', 'awaiting_verification', 'settled')
    and date_trunc('month', c.starts_at at time zone 'Asia/Kuala_Lumpur')::date = month_start;
$$;


--
-- Name: pk_notify(uuid, uuid[], text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_notify(cid uuid, user_ids uuid[], message_text text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  insert into notifications (user_id, actor_id, type, target_type, target_id, message)
  select distinct u, auth.uid(), 'challenge', 'pk', cid, message_text
  from unnest(user_ids) as u where u is distinct from auth.uid();
$$;


--
-- Name: pk_pending_approvals(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_pending_approvals() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select id from challenges
  where pk_version = 1 and status in ('awaiting_approval', 'awaiting_verification') and pk_can_approve(id, auth.uid());
$$;


--
-- Name: pk_quarter(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_quarter(ts timestamp with time zone) RETURNS date
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  select date_trunc('quarter', ts at time zone 'Asia/Kuala_Lumpur')::date;
$$;


--
-- Name: pk_rank_of(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_rank_of(user_id_param uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce((select r.rank from profiles p join org_roles r on r.name = p.role where p.id = user_id_param), 1000);
$$;


--
-- Name: pk_record_debts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_record_debts() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: pk_record_terms(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_record_terms(cid uuid, action_name text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  insert into challenge_terms_history (challenge_id, version, action, actor_id, terms)
  select cid, terms_version, action_name, auth.uid(), pk_terms_snapshot(cid) from challenges where id = cid;
$$;


--
-- Name: pk_request_settlement(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_request_settlement(cid uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  c challenges := (select x from challenges x where x.id = cid for update);
  me challenge_participants := (select x from challenge_participants x where x.challenge_id = cid and x.user_id = auth.uid());
begin
  if c.id is null or c.pk_version <> 1 then raise exception 'PK not found.'; end if;
  if me.user_id is null and not viewer_is_admin() then raise exception 'Only people in this PK can settle it.'; end if;
  if c.status <> 'active' then raise exception 'Only a live PK can be settled.'; end if;

  if now() >= c.ends_at then
    perform pk_settle_start(cid, false, null);
    return;
  end if;
  -- Early settlement: your side has reached the agreed winning target.
  if me.user_id is null or not pk_target_reached(cid, me.side) then
    raise exception '%', case
      when c.format = 'self_declaration' then 'You can settle early once you''ve hit 100% of your declared target. Otherwise it settles after ' || to_char(c.ends_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon') || '.'
      when c.winning_target is null then 'This PK has no winning target, so it settles after ' || to_char(c.ends_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon') || '.'
      else 'You can settle early once your side reaches the winning target (' || c.winning_target || '). Otherwise it settles after ' || to_char(c.ends_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon') || '.' end;
  end if;
  perform pk_log(cid, 'early', pk_me() || ' hit the winning target early and asked to settle.');
  perform pk_settle_start(cid, true, me.side);
end;
$$;


--
-- Name: pk_respond(uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_respond(cid uuid, response text, counter jsonb DEFAULT NULL::jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  uid uuid := auth.uid();
  c challenges := (select x from challenges x where x.id = cid for update);
  me challenge_participants := (select x from challenge_participants x where x.challenge_id = cid and x.user_id = auth.uid());
  s pk_settings := (select x from pk_settings x where x.id = 1);
  others uuid[] := array(select user_id from challenge_participants where challenge_id = cid);
  p jsonb;
begin
  if c.id is null or c.pk_version <> 1 then raise exception 'PK not found.'; end if;
  if me.user_id is null then raise exception 'You''re not part of this PK.'; end if;
  if c.status not in ('awaiting_opponent', 'countered') then raise exception 'This PK isn''t waiting for a response.'; end if;

  if response = 'decline' then
    update challenges set status = 'declined' where id = cid;
    perform pk_log(cid, 'declined', pk_me() || ' declined the challenge.');
    perform pk_notify(cid, others, pk_me() || ' declined your PK: ' || c.topic);
    return;
  end if;

  if me.accepted_at is not null then raise exception 'You''ve already accepted these terms.'; end if;

  if response = 'accept' then
    perform pk_check_participant(cid, uid);
    update challenge_participants set accepted_at = now() where challenge_id = cid and user_id = uid;
    perform pk_log(cid, 'accepted', pk_me() || ' accepted the terms.');
    perform pk_notify(cid, others, pk_me() || ' accepted your PK: ' || c.topic);
    perform pk_all_accepted(cid);
    return;
  end if;

  if response <> 'counter' then raise exception 'Unknown response.'; end if;
  if not me.is_captain then raise exception 'Only a team captain can counter-propose.'; end if;
  if c.counter_round >= s.max_counter_rounds then
    raise exception 'Both counter-proposals have been used. Accept or decline these terms.';
  end if;

  update challenges set
    description = coalesce(nullif(trim(counter->>'description'), ''), description),
    metric = coalesce(nullif(trim(counter->>'metric'), ''), metric),
    metric_definition = coalesce(nullif(trim(counter->>'metric_definition'), ''), metric_definition),
    direction = coalesce(counter->>'direction', direction),
    scoring = case when format = 'self_declaration' then null else coalesce(counter->>'scoring', scoring) end,
    winning_target = case when counter ? 'winning_target' then nullif(counter->>'winning_target', '')::numeric else winning_target end,
    starts_at = coalesce(nullif(counter->>'starts_at', '')::timestamptz, starts_at),
    ends_at = coalesce(nullif(counter->>'ends_at', '')::timestamptz, ends_at),
    update_frequency = coalesce(nullif(trim(counter->>'update_frequency'), ''), update_frequency),
    reward = case when counter ? 'reward' then nullif(trim(counter->>'reward'), '') else reward end,
    punishment = case when counter ? 'punishment' then nullif(trim(counter->>'punishment'), '') else punishment end,
    pk_money = coalesce(nullif(counter->>'pk_money', '')::numeric, pk_money),
    proof_method = coalesce(nullif(trim(counter->>'proof_method'), ''), proof_method),
    tiebreaker = case when counter ? 'tiebreaker' then nullif(trim(counter->>'tiebreaker'), '') else tiebreaker end,
    counter_round = counter_round + 1, terms_version = terms_version + 1, status = 'countered'
  where id = cid;
  for p in select * from jsonb_array_elements(coalesce(counter->'participants', '[]'::jsonb)) loop
    update challenge_participants
    set baseline = nullif(p->>'baseline', '')::numeric, target = nullif(p->>'target', '')::numeric
    where challenge_id = cid and user_id = (p->>'user_id')::uuid;
  end loop;
  update challenges set winning_target = (select target from challenge_participants where challenge_id = cid and side = 'A' limit 1)
  where id = cid and format = 'self_declaration';
  update challenge_participants set accepted_at = case when user_id = uid then now() end where challenge_id = cid;

  perform pk_check_terms(cid);
  perform pk_check_participant(cid, uid);
  perform pk_record_terms(cid, 'countered');
  perform pk_log(cid, 'countered', pk_me() || ' sent a counter-proposal (' || c.counter_round + 1 || ' of ' || s.max_counter_rounds || ').');
  perform pk_notify(cid, others, pk_me() || ' sent a counter-proposal on: ' || c.topic);
end;
$$;


--
-- Name: pk_review(uuid, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_review(cid uuid, approve boolean, note text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  c challenges := (select x from challenges x where x.id = cid for update);
  p record;
begin
  if c.id is null or c.pk_version <> 1 then raise exception 'PK not found.'; end if;
  if c.status <> 'awaiting_approval' then raise exception 'This PK isn''t waiting for approval.'; end if;
  if not pk_can_approve(cid, auth.uid()) then raise exception 'You can''t approve this PK.'; end if;

  if not approve then
    if coalesce(trim(note), '') = '' then raise exception 'Say why you''re rejecting it, so they can fix it.'; end if;
    update challenges set status = 'rejected', review_note = trim(note), approved_by = auth.uid(), approved_at = now() where id = cid;
    perform pk_log(cid, 'rejected', pk_me() || ' rejected the PK: ' || trim(note));
    perform pk_notify(cid, array(select user_id from challenge_participants where challenge_id = cid),
      'Your PK "' || c.topic || '" wasn''t approved: ' || trim(note));
    return;
  end if;

  perform pk_check_terms(cid);
  for p in select user_id from challenge_participants where challenge_id = cid loop
    perform pk_check_participant(cid, p.user_id);
  end loop;
  update challenges set status = 'active', review_note = nullif(trim(note), ''), approved_by = auth.uid(), approved_at = now()
  where id = cid;
  perform pk_record_terms(cid, 'approved');
  perform pk_log(cid, 'approved', pk_me() || ' approved the PK. It''s on!');
  perform pk_notify(cid, array(select user_id from challenge_participants where challenge_id = cid),
    'Your PK "' || c.topic || '" was approved. It''s on!');
end;
$$;


--
-- Name: pk_role_rank(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_role_rank(role_name text) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select rank from org_roles where name = role_name;
$$;


--
-- Name: pk_settle_start(uuid, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_settle_start(cid uuid, early boolean, forced_side text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  ws text := coalesce(forced_side, pk_winner_side(cid));
  c challenges := (select x from challenges x where x.id = cid);
begin
  update challenges set
    winner_side = ws,
    winner_id = (select user_id from challenge_participants where challenge_id = cid and side = ws order by is_captain desc limit 1),
    final_score_a = (select score from pk_side_scores(cid) where side = 'A'),
    final_score_b = (select score from pk_side_scores(cid) where side = 'B'),
    early_settlement = early,
    settlement_requested_by = auth.uid(),
    settlement_requested_at = now(),
    status = case when ws is null then 'awaiting_verification' else 'awaiting_playbook' end
  where id = cid;

  if ws is null then
    perform pk_log(cid, 'settling', 'Final scores are a draw. Waiting for the approver to confirm or apply the tiebreaker.');
    perform pk_notify(cid, array(select pk_approver_ids(cid)), 'A PK ended in a draw and needs confirming: ' || c.topic);
  else
    perform pk_log(cid, 'settling', 'Scores are locked. @' || coalesce((select username from profiles where id =
      (select winner_id from challenges where id = cid)), 'the winner') || ' wins, pending their playbook and approval.');
  end if;
  perform pk_notify(cid, array(select user_id from challenge_participants where challenge_id = cid),
    'Scores are locked on "' || c.topic || '".' || case when ws is null then ' It''s a draw.' else ' Winner: side ' || ws || '.' end);
end;
$$;


--
-- Name: pk_side_scores(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_side_scores(cid uuid) RETURNS TABLE(side text, score numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with c as (select * from challenges where id = cid),
  p as (
    select cp.side, cp.baseline, cp.target, coalesce(cp.current_value, cp.baseline, 0) as cur, c.*
    from challenge_participants cp cross join c where cp.challenge_id = cid)
  select p.side, round(case
    when max(p.format) = 'self_declaration' then
      100 * sum(case when p.direction = 'lower' then p.baseline - p.cur else p.cur - p.baseline end)
          / nullif(sum(abs(p.target - p.baseline)), 0)
    when max(p.scoring) = 'absolute' then sum(p.cur)
    when max(p.scoring) = 'improvement' then
      sum(case when p.direction = 'lower' then p.baseline - p.cur else p.cur - p.baseline end)
    when max(p.direction) = 'lower' then 100 * sum(p.target) / nullif(sum(p.cur), 0)
    else 100 * sum(p.cur) / nullif(sum(p.target), 0)
  end, 2)
  from p
  where p.format <> 'self_declaration' or p.side = 'A'
  group by p.side
  order by p.side;
$$;


--
-- Name: pk_submit_playbook(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_submit_playbook(cid uuid, extra text, worked text, copy text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  c challenges := (select x from challenges x where x.id = cid for update);
  me challenge_participants := (select x from challenge_participants x where x.challenge_id = cid and x.user_id = auth.uid());
begin
  if c.id is null or c.pk_version <> 1 then raise exception 'PK not found.'; end if;
  if c.status <> 'awaiting_playbook' then raise exception 'This PK isn''t waiting for a playbook.'; end if;
  if me.user_id is null or me.side <> c.winner_side or (c.pk_type = 'team' and not me.is_captain) then
    raise exception 'Only the winner (the captain, for teams) writes the playbook.';
  end if;
  if length(trim(coalesce(extra, ''))) < 40 or length(trim(coalesce(worked, ''))) < 40 or length(trim(coalesce(copy, ''))) < 40 then
    raise exception 'Be specific: at least 40 characters per answer. Say what you actually did, not "worked harder".';
  end if;

  insert into pk_playbooks (challenge_id, author_id, what_extra, what_worked, how_to_copy)
  values (cid, auth.uid(), trim(extra), trim(worked), trim(copy))
  on conflict (challenge_id) do update set author_id = excluded.author_id, what_extra = excluded.what_extra,
    what_worked = excluded.what_worked, how_to_copy = excluded.how_to_copy, updated_at = now();
  update challenges set status = 'awaiting_verification' where id = cid;
  perform pk_log(cid, 'playbook', pk_me() || ' submitted the winner playbook.');
  perform pk_notify(cid, array(select pk_approver_ids(cid)), 'A PK result and playbook need your confirmation: ' || c.topic);
end;
$$;


--
-- Name: pk_target_reached(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_target_reached(cid uuid, side_param text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  c challenges := (select x from challenges x where x.id = cid);
  s numeric := (select score from pk_side_scores(cid) where side = side_param);
begin
  if s is null or not exists (
    select 1 from challenge_score_updates u join challenge_participants p on p.challenge_id = u.challenge_id and p.user_id = u.user_id
    where u.challenge_id = cid and p.side = side_param) then
    return false;
  end if;
  if c.format = 'self_declaration' then return side_param = 'A' and s >= 100; end if;
  if c.winning_target is null then return false; end if;
  if c.scoring = 'absolute' and c.direction = 'lower' then return s <= c.winning_target; end if;
  return s >= c.winning_target;
end;
$$;


--
-- Name: pk_terminate(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_terminate(cid uuid, reason text, note text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  c challenges := (select x from challenges x where x.id = cid for update);
  msg text := nullif(trim(coalesce(note, '')), '');
  label text := case reason
    when 'resignation' then 'a resignation' when 'transfer' then 'a transfer'
    when 'data_failure' then 'a data or system failure' when 'customer_pool_change' then 'a customer pool change'
    when 'emergency' then 'an emergency' else 'a special case' end;
begin
  if c.id is null or c.pk_version <> 1 then raise exception 'PK not found.'; end if;
  if not (viewer_is_admin() or pk_can_approve(cid, auth.uid())) then
    raise exception 'Only an admin or an upline who can approve this PK can terminate it.';
  end if;
  if c.status not in ('active', 'settlement_requested', 'awaiting_playbook', 'awaiting_verification') then
    raise exception 'Only an approved PK that isn''t settled yet can be terminated.';
  end if;
  if reason not in ('resignation', 'transfer', 'data_failure', 'customer_pool_change', 'emergency', 'other') then
    raise exception 'Pick a reason.';
  end if;
  if msg is null then raise exception 'Add a note explaining what happened.'; end if;

  update challenges set status = 'terminated', terminated_reason = reason, terminated_note = msg,
    terminated_by = auth.uid(), terminated_at = now(), winner_side = null, winner_id = null
  where id = cid;
  perform pk_log(cid, 'terminated', pk_me() || ' terminated the PK because of ' || label || ': ' || msg);
  perform pk_notify(cid, array(select user_id from challenge_participants where challenge_id = cid),
    '"' || c.topic || '" was terminated because of ' || label || '. No points, and any PK Money stake is void.');
end;
$$;


--
-- Name: pk_terms_snapshot(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_terms_snapshot(cid uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select to_jsonb(t) || jsonb_build_object('participants', coalesce((
    select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'username', pr.username, 'side', p.side,
                                        'is_captain', p.is_captain, 'baseline', p.baseline, 'target', p.target) order by p.side, pr.username)
    from challenge_participants p join profiles pr on pr.id = p.user_id where p.challenge_id = cid), '[]'::jsonb))
  from (
    select topic as title, description, metric, metric_definition, direction, scoring, format, method, pk_type,
           department, winning_target, starts_at, ends_at, update_frequency, reward, punishment, pk_money,
           proof_method, tiebreaker, terms_version
    from challenges where id = cid
  ) t;
$$;


--
-- Name: pk_update_score(uuid, numeric, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_update_score(cid uuid, new_value numeric, proof text, note text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  uid uuid := auth.uid();
  c challenges := (select x from challenges x where x.id = cid);
  me challenge_participants := (select x from challenge_participants x where x.challenge_id = cid and x.user_id = auth.uid());
begin
  if c.id is null or c.pk_version <> 1 then raise exception 'PK not found.'; end if;
  if me.user_id is null then raise exception 'Only people in this PK can update scores.'; end if;
  if c.format = 'self_declaration' and me.side <> 'A' then raise exception 'Only the person who declared can update progress.'; end if;
  if c.status <> 'active' then raise exception 'Scores can only be updated while the PK is running.'; end if;
  if now() < c.starts_at then raise exception 'This PK hasn''t started yet.'; end if;
  if new_value is null or new_value < 0 then raise exception 'Enter your current number.'; end if;
  if coalesce(trim(proof), '') = '' then raise exception 'Attach proof with every update.'; end if;
  if split_part(proof, '/', 1) <> uid::text then raise exception 'That proof file isn''t yours.'; end if;

  insert into challenge_score_updates (challenge_id, user_id, value, proof_path, comment)
  values (cid, uid, new_value, trim(proof), nullif(trim(note), ''));
  update challenge_participants set current_value = new_value where challenge_id = cid and user_id = uid;
  perform pk_log(cid, 'score', pk_me() || ' updated their score to ' || trim(to_char(new_value, 'FM999999999990.##')) || '.');
  perform pk_notify(cid, array(select user_id from challenge_participants where challenge_id = cid),
    pk_me() || ' posted a score update on: ' || c.topic);
end;
$$;


--
-- Name: pk_verify(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_verify(cid uuid, decision text, note text DEFAULT NULL::text, tiebreak_side text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  c challenges := (select x from challenges x where x.id = cid for update);
  everyone uuid[] := array(select user_id from challenge_participants where challenge_id = cid);
  msg text := nullif(trim(coalesce(note, '')), '');
begin
  if c.id is null or c.pk_version <> 1 then raise exception 'PK not found.'; end if;
  if c.status <> 'awaiting_verification' then raise exception 'This PK isn''t waiting for confirmation.'; end if;
  if not pk_can_approve(cid, auth.uid()) then raise exception 'You can''t confirm this PK.'; end if;
  if decision in ('playbook', 'reopen') and msg is null then raise exception 'Add a note saying what needs fixing.'; end if;

  if decision = 'reopen' then
    update challenges set status = 'active', winner_side = null, winner_id = null, final_score_a = null, final_score_b = null,
      early_settlement = false, settlement_requested_by = null, settlement_requested_at = null where id = cid;
    delete from pk_playbooks where challenge_id = cid;
    perform pk_log(cid, 'reopened', pk_me() || ' reopened the PK to fix the scores: ' || msg);
    perform pk_notify(cid, everyone, 'Your PK "' || c.topic || '" was reopened: ' || msg);
    return;
  end if;

  if decision = 'playbook' then
    if c.winner_side is null then raise exception 'A draw has no playbook to send back.'; end if;
    update challenges set status = 'awaiting_playbook', review_note = msg where id = cid;
    perform pk_log(cid, 'playbook_returned', pk_me() || ' sent the playbook back: ' || msg);
    perform pk_notify(cid, array[c.winner_id], 'Your playbook for "' || c.topic || '" needs more detail: ' || msg);
    return;
  end if;

  if decision <> 'confirm' then raise exception 'Unknown decision.'; end if;

  -- A draw can be decided by the agreed tiebreaker; the winner then writes a playbook.
  if c.winner_side is null and tiebreak_side in ('A', 'B') then
    update challenges set winner_side = tiebreak_side, status = 'awaiting_playbook',
      winner_id = (select user_id from challenge_participants where challenge_id = cid and side = tiebreak_side order by is_captain desc limit 1)
    where id = cid;
    perform pk_log(cid, 'tiebreak', pk_me() || ' applied the tiebreaker: side ' || tiebreak_side || ' wins' || coalesce(' (' || msg || ')', '') || '.');
    perform pk_notify(cid, everyone, 'Tiebreaker applied on "' || c.topic || '". Side ' || tiebreak_side || ' wins.');
    return;
  end if;
  if c.winner_side is not null and not exists (select 1 from pk_playbooks where challenge_id = cid) then
    raise exception 'The winner hasn''t written a playbook yet.';
  end if;

  insert into pk_points (user_id, challenge_id, points, outcome, department, period_start)
  select p.user_id, cid,
    case when c.winner_side is null then 0.5 when p.side = c.winner_side then 3.5 else -0.5 end,
    case when c.winner_side is null then 'draw' when p.side = c.winner_side then 'win' else 'loss' end,
    c.department, pk_quarter(now())
  from challenge_participants p where p.challenge_id = cid
  on conflict (user_id, challenge_id) do nothing;

  update challenges set status = 'settled', settled_by = auth.uid(), settled_at = now(), review_note = coalesce(msg, review_note)
  where id = cid;
  perform pk_log(cid, 'settled', pk_me() || ' confirmed the result. PK points are in.' || coalesce(' Note: ' || msg, ''));
  perform pk_notify(cid, everyone, '"' || c.topic || '" is settled. ' ||
    case when c.winner_side is null then 'It''s a draw, +0.5 PK points each.' else 'Winners +3.5 PK points, the other side -0.5.' end);
end;
$$;


--
-- Name: pk_winner_side(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pk_winner_side(cid uuid) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  c challenges := (select x from challenges x where x.id = cid);
  a numeric := coalesce((select score from pk_side_scores(cid) where side = 'A'), 0);
  b numeric := coalesce((select score from pk_side_scores(cid) where side = 'B'), 0);
begin
  if c.format = 'self_declaration' then return case when a >= 100 then 'A' else 'B' end; end if;
  if a = b then return null; end if;
  if c.scoring = 'absolute' and c.direction = 'lower' then return case when a < b then 'A' else 'B' end; end if;
  return case when a > b then 'A' else 'B' end;
end;
$$;


--
-- Name: place_wager(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.place_wager(bet_id_param uuid, option_id_param uuid, amount_param integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  bet_status text;
  bet_closes timestamptz;
  my_points integer;
  already_wagered boolean;
begin
  if amount_param <= 0 then
    raise exception 'Wager must be a positive amount';
  end if;

  select status, closes_at into bet_status, bet_closes from public.bets where id = bet_id_param;
  if bet_status is null then
    raise exception 'Bet not found';
  end if;
  if bet_status != 'open' then
    raise exception 'This bet is no longer open';
  end if;
  if bet_closes is not null and now() > bet_closes then
    raise exception 'Betting has closed for this bet';
  end if;

  if not exists (select 1 from public.bet_options where id = option_id_param and bet_id = bet_id_param) then
    raise exception 'Invalid option for this bet';
  end if;

  select exists(select 1 from public.bet_wagers where bet_id = bet_id_param and user_id = auth.uid())
  into already_wagered;
  if already_wagered then
    raise exception 'You already placed a wager on this bet';
  end if;

  select points into my_points from public.profiles where id = auth.uid();
  if my_points is null or my_points < amount_param then
    raise exception 'Not enough points';
  end if;

  insert into public.bet_wagers (bet_id, option_id, user_id, amount)
  values (bet_id_param, option_id_param, auth.uid(), amount_param);

  insert into public.point_transactions (user_id, amount, reason)
  values (auth.uid(), -amount_param, 'Wager placed');
end;
$$;


--
-- Name: points_ledger_add(uuid, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.points_ledger_add(uid uuid, amount integer, reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform set_config('app.points_allowed', 'on', true);
  -- Callers send their own, more specific notification.
  perform set_config('app.skip_points_notify', 'on', true);
  insert into point_transactions (user_id, amount, reason) values (uid, amount, reason);
  perform set_config('app.skip_points_notify', 'off', true);
  perform set_config('app.points_allowed', 'off', true);
end;
$$;


--
-- Name: protect_birthday_field(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_birthday_field() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.birthday is distinct from old.birthday then
    if old.birthday is not null and coalesce(current_setting('app.birthday_admin_override', true), '') <> 'true' then
      raise exception 'Birthday is already set. Ask an admin to change it.';
    end if;
  end if;
  return new;
end;
$$;


--
-- Name: protect_role_department_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_role_department_fields() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.role is distinct from old.role and old.role is not null
     and coalesce(current_setting('app.role_admin_override', true), '') <> 'true' then
    raise exception 'Role is already set. Ask an admin to change it.';
  end if;
  if new.department is distinct from old.department and old.department is not null
     and coalesce(current_setting('app.role_admin_override', true), '') <> 'true' then
    raise exception 'Department is already set. Ask an admin to change it.';
  end if;
  return new;
end;
$$;


--
-- Name: push_new_notification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.push_new_notification() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  project_url text;
  webhook_secret text;
begin
  begin
    project_url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1);
    webhook_secret := (select decrypted_secret from vault.decrypted_secrets where name = 'push_webhook_secret' limit 1);
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


--
-- Name: reactivate_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reactivate_user(target_user uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.has_permission('manage_users') then
    raise exception 'Not authorized';
  end if;
  update public.profiles set is_deleted = false where id = target_user;
end;
$$;


--
-- Name: redeem_reward(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.redeem_reward(reward_id_param uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  uid uuid := auth.uid();
  r rewards := (select x from rewards x where x.id = reward_id_param);
  redemption_id uuid := gen_random_uuid();
  who text := (select coalesce('@' || username, 'Someone') from profiles where id = auth.uid());
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if not coalesce((select revamp_enabled from points_settings where id = 1), false) then
    raise exception 'The rewards shop is turned off';
  end if;
  if r.id is null or not r.active then raise exception 'Reward not available'; end if;

  update rewards set stock = stock - 1 where id = r.id and stock is not null and stock > 0;
  if r.stock is not null and not found then raise exception 'Out of stock'; end if;

  if coalesce((select points from profiles where id = uid for update), 0) < r.cost then
    raise exception 'Not enough points';
  end if;
  perform points_ledger_add(uid, -r.cost, 'Reward: ' || r.name);

  insert into reward_redemptions (id, reward_id, reward_name, user_id, cost)
  values (redemption_id, r.id, r.name, uid, r.cost);

  insert into notifications (user_id, actor_id, type, target_type, target_id, message)
  select p.id, uid, 'points', 'admin', redemption_id, who || ' redeemed "' || r.name || '" · needs approval'
  from profiles p where p.is_admin and coalesce(p.is_deleted, false) = false;
  return redemption_id;
end;
$$;


--
-- Name: remove_deleted_achievement(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_deleted_achievement() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update profiles set unlocked_titles = array_remove(unlocked_titles, old.key),
                      active_title = case when active_title = old.key then null else active_title end
  where old.key = any(unlocked_titles);
  return old;
end;
$$;


--
-- Name: resolve_bet(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_bet(bet_id_param uuid, winning_option_id_param uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  bet_status text;
  total_pool integer;
  winning_pool integer;
  wager record;
  payout numeric;
begin
  if not public.has_permission('manage_bets') then
    raise exception 'Not authorized';
  end if;

  select status into bet_status from public.bets where id = bet_id_param;
  if bet_status is distinct from 'open' then
    raise exception 'Bet is not open';
  end if;

  if not exists (select 1 from public.bet_options where id = winning_option_id_param and bet_id = bet_id_param) then
    raise exception 'Invalid winning option';
  end if;

  select coalesce(sum(amount), 0) into total_pool from public.bet_wagers where bet_id = bet_id_param;
  select coalesce(sum(amount), 0) into winning_pool
  from public.bet_wagers where bet_id = bet_id_param and option_id = winning_option_id_param;

  if winning_pool > 0 then
    for wager in select * from public.bet_wagers where bet_id = bet_id_param and option_id = winning_option_id_param loop
      payout := round(wager.amount::numeric / winning_pool::numeric * total_pool::numeric);
      if payout > 0 then
        insert into public.point_transactions (user_id, amount, reason)
        values (wager.user_id, payout::integer, 'Won a bet');
      end if;
    end loop;
  else
    -- Nobody picked the winning option -- refund everyone rather than
    -- keeping their points in limbo.
    for wager in select * from public.bet_wagers where bet_id = bet_id_param loop
      insert into public.point_transactions (user_id, amount, reason)
      values (wager.user_id, wager.amount, 'Bet refunded (no winners)');
    end loop;
  end if;

  update public.bets set status = 'resolved', winning_option_id = winning_option_id_param where id = bet_id_param;
end;
$$;


--
-- Name: respond_challenge(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.respond_challenge(challenge_id_param uuid, accept boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  c record;
begin
  select * into c from public.challenges where id = challenge_id_param;
  if c is null then
    raise exception 'Challenge not found';
  end if;
  if c.opponent_id <> auth.uid() then
    raise exception 'Only the challenged person can respond';
  end if;
  if c.status <> 'pending' then
    raise exception 'This challenge already has a response';
  end if;

  update public.challenges
  set status = case when accept then 'active' else 'declined' end,
      starts_at = case when accept then now() else starts_at end
  where id = challenge_id_param;
end;
$$;


--
-- Name: role_rank(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.role_rank(role_param text) RETURNS integer
    LANGUAGE sql IMMUTABLE
    AS $$
  select case role_param
    when 'CEO' then 0
    when 'HOD' then 1
    when 'MANAGER' then 2
    when 'SPV' then 3
    when 'ASPV' then 4
    when 'TL' then 5
    when 'ATL' then 6
    when 'SNR' then 7
    when 'JNR' then 8
    else null
  end;
$$;


--
-- Name: save_push_subscription(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_push_subscription(endpoint_param text, p256dh_param text, auth_param text, user_agent_param text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: send_dm(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_dm(conversation_id_param uuid, body_param text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  c record;
  recipient uuid;
  new_id uuid;
  actor_username text;
begin
  if body_param is null or length(trim(body_param)) = 0 then
    raise exception 'Message cannot be empty';
  end if;

  select * into c from public.dm_conversations where id = conversation_id_param;
  if c is null then
    raise exception 'Conversation not found';
  end if;
  if auth.uid() not in (c.user_a, c.user_b) then
    raise exception 'Not authorized';
  end if;

  recipient := case when c.user_a = auth.uid() then c.user_b else c.user_a end;

  insert into public.direct_messages (conversation_id, sender_id, body)
  values (conversation_id_param, auth.uid(), trim(body_param))
  returning id into new_id;

  update public.dm_conversations set last_message_at = now() where id = conversation_id_param;

  select username into actor_username from public.profiles where id = auth.uid();
  insert into public.notifications (user_id, actor_id, type, target_type, target_id, message)
  values (recipient, auth.uid(), 'dm', 'dm', conversation_id_param::text,
          coalesce('@' || actor_username, 'Someone') || ' sent you a message');

  return new_id;
end;
$$;


--
-- Name: set_active_accessory(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_active_accessory(accessory_key text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if accessory_key is not null and accessory_key not in (
    'angel-wings', 'neon-headphones', 'rocket-pack', 'wizard-hat', 'cyber-cat-ears',
    'lightning-bolt-aura', 'floating-hearts', 'pixel-sword', 'mini-planet', 'champion-laurel'
  ) then
    raise exception 'Unknown accessory %', accessory_key;
  end if;

  update profiles set active_accessory = accessory_key where id = auth.uid();
end;
$$;


--
-- Name: set_active_border(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_active_border(border_key text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if border_key is not null and border_key not in (
    'cosmic-orbit', 'pixel-glitch', 'electric-pulse', 'sakura-bloom',
    'trophy-halo', 'crystal-prism', 'meteor-trail', 'galaxy-crown'
  ) then
    raise exception 'Unknown border %', border_key;
  end if;

  update profiles set active_border = border_key where id = auth.uid();
end;
$$;


--
-- Name: set_active_title(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_active_title(title_key text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if title_key is not null and not exists (
    select 1 from public.profiles where id = auth.uid() and title_key = any(unlocked_titles)
  ) then
    raise exception 'Title not unlocked';
  end if;

  update public.profiles set active_title = title_key where id = auth.uid();
end;
$$;


--
-- Name: set_my_birthday(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_my_birthday(birthday_param date) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  existing date;
begin
  if birthday_param is null then
    raise exception 'Birthday is required';
  end if;
  select birthday into existing from public.profiles where id = auth.uid();
  if existing is not null then
    raise exception 'Your birthday is already set. Ask an admin to change it.';
  end if;
  update public.profiles set birthday = birthday_param where id = auth.uid();
end;
$$;


--
-- Name: set_my_role_department(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_my_role_department(role_param text, department_param text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if role_param is null or department_param is null then
    raise exception 'Role and department are both required';
  end if;
  if not exists (select 1 from org_roles where name = role_param) then raise exception 'Invalid role'; end if;
  if not exists (select 1 from org_departments where name = department_param) then raise exception 'Invalid department'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and (role is not null or department is not null)) then
    raise exception 'Your role/department is already set. Ask an admin to change it.';
  end if;
  update public.profiles set role = role_param, department = department_param where id = auth.uid();
end;
$$;


--
-- Name: set_user_admin(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_user_admin(target_user uuid, value boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  update public.profiles set is_admin = value where id = target_user;
end;
$$;


--
-- Name: set_user_department(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_user_department(target_user uuid, dept text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Not authorized';
  end if;
  if dept is not null and dept not in ('RTN VIP','RTN EXC','MANAGEMENT','DESIGN','DATA ANALYST','MARKETING') then
    raise exception 'Invalid department';
  end if;
  perform set_config('app.role_admin_override', 'true', true);
  update public.profiles set department = dept where id = target_user;
end;
$$;


--
-- Name: set_user_permissions(uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_user_permissions(target_user uuid, perms text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  update public.profiles set permissions = perms where id = target_user;
end;
$$;


--
-- Name: submit_quiz_answer(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_quiz_answer(question_id_param uuid, selected_index_param integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  correct_idx integer;
  is_correct boolean;
  already_answered boolean;
  total_correct integer;
begin
  select exists(
    select 1 from public.quiz_answers where user_id = auth.uid() and question_id = question_id_param
  ) into already_answered;

  if already_answered then
    raise exception 'Already answered this question';
  end if;

  select correct_index into correct_idx from public.quiz_questions where id = question_id_param;
  if correct_idx is null then
    raise exception 'Question not found';
  end if;

  is_correct := selected_index_param = correct_idx;

  insert into public.quiz_answers (user_id, question_id, selected_index, correct)
  values (auth.uid(), question_id_param, selected_index_param, is_correct);

  if is_correct then
    insert into public.point_transactions (user_id, amount, reason)
    values (auth.uid(), 15, 'Answered a quiz question correctly');

    select count(*) into total_correct
    from public.quiz_answers where user_id = auth.uid() and correct;

    if total_correct >= 5 then
      perform public.award_title(auth.uid(), 'quiz_whiz');
    end if;
  end if;

  return jsonb_build_object('correct', is_correct, 'correct_index', correct_idx);
end;
$$;


--
-- Name: touch_presence(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_presence() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  open_session_id uuid;
begin
  update profiles set last_seen_at = now() where id = auth.uid();

  open_session_id := (
    select id
    from login_sessions
    where user_id = auth.uid()
      and ended_at is null
      and last_heartbeat_at > now() - interval '2 minutes'
    order by started_at desc
    limit 1
  );

  if open_session_id is not null then
    update login_sessions set last_heartbeat_at = now() where id = open_session_id;
  else
    update login_sessions
    set ended_at = last_heartbeat_at
    where user_id = auth.uid() and ended_at is null;

    insert into login_sessions (user_id) values (auth.uid());
  end if;
end;
$$;


--
-- Name: trigger_birthday_emails(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_birthday_emails() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  project_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1);
  webhook_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'push_webhook_secret' limit 1);
begin
  if project_url is null or webhook_secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/send-birthday-emails',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', webhook_secret)
  );
end;
$$;


--
-- Name: update_challenge_score(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_challenge_score(challenge_id_param uuid, score_param integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  c record;
begin
  if score_param < 0 then
    raise exception 'Score cannot be negative';
  end if;

  select * into c from public.challenges where id = challenge_id_param;
  if c is null then
    raise exception 'Challenge not found';
  end if;
  if c.status <> 'active' then
    raise exception 'Challenge is not active';
  end if;

  if c.creator_id = auth.uid() then
    update public.challenges set score_creator = score_param where id = challenge_id_param;
  elsif c.opponent_id = auth.uid() then
    update public.challenges set score_opponent = score_param where id = challenge_id_param;
  else
    raise exception 'Not authorized';
  end if;
end;
$$;


--
-- Name: validate_role_department(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_role_department() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if new.role is not null and not exists (select 1 from org_roles where name = new.role) then
    raise exception 'Invalid role: %', new.role;
  end if;
  if new.department is not null and not exists (select 1 from org_departments where name = new.department) then
    raise exception 'Invalid department: %', new.department;
  end if;
  return new;
end;
$$;


--
-- Name: viewer_is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.viewer_is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;


--
-- Name: wordle_guess(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.wordle_guess(guess_word text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  target text;
  target_letters text[];
  guess_letters text[];
  statuses text[];
  i integer;
  existing_attempts integer;
  already_finished boolean;
  first_attempt_time timestamptz;
  is_correct boolean;
  duration integer;
  letter_counts jsonb := '{}'::jsonb;
  ch text;
begin
  guess_word := lower(trim(guess_word));

  if guess_word !~ '^[a-z]{5}$' then
    raise exception 'Guess must be 5 letters';
  end if;

  if not exists (select 1 from public.wordle_valid_guesses where word = guess_word) then
    raise exception 'Not a valid word';
  end if;

  select exists (
    select 1 from public.wordle_results where user_id = auth.uid() and play_date = current_date
  ) into already_finished;

  if already_finished then
    raise exception 'You already finished today''s puzzle';
  end if;

  select count(*) into existing_attempts
  from public.wordle_attempts
  where user_id = auth.uid() and play_date = current_date;

  if existing_attempts >= 6 then
    raise exception 'No attempts remaining';
  end if;

  target := public.wordle_today_word();
  target_letters := regexp_split_to_array(target, '');
  guess_letters := regexp_split_to_array(guess_word, '');
  statuses := array_fill('absent'::text, array[5]);

  for i in 1..5 loop
    if guess_letters[i] = target_letters[i] then
      statuses[i] := 'correct';
    else
      ch := target_letters[i];
      letter_counts := jsonb_set(letter_counts, array[ch], to_jsonb(coalesce((letter_counts->>ch)::int, 0) + 1));
    end if;
  end loop;

  for i in 1..5 loop
    if statuses[i] != 'correct' then
      ch := guess_letters[i];
      if coalesce((letter_counts->>ch)::int, 0) > 0 then
        statuses[i] := 'present';
        letter_counts := jsonb_set(letter_counts, array[ch], to_jsonb((letter_counts->>ch)::int - 1));
      end if;
    end if;
  end loop;

  insert into public.wordle_attempts (user_id, play_date, guess_number, guess, statuses)
  values (auth.uid(), current_date, existing_attempts + 1, guess_word, statuses);

  is_correct := guess_word = target;

  if is_correct or existing_attempts + 1 >= 6 then
    select min(created_at) into first_attempt_time
    from public.wordle_attempts
    where user_id = auth.uid() and play_date = current_date;

    duration := extract(epoch from (now() - first_attempt_time))::int;

    insert into public.wordle_results (user_id, play_date, solved, guess_count, duration_seconds)
    values (auth.uid(), current_date, is_correct, existing_attempts + 1, case when is_correct then duration else null end);

    if is_correct then
      insert into public.point_transactions (user_id, amount, reason)
      values (auth.uid(), greatest(30 - existing_attempts * 3, 10), 'Solved today''s Wordle');

      perform public.award_title(auth.uid(), 'word_wizard');
    end if;
  end if;

  return jsonb_build_object(
    'statuses', statuses,
    'correct', is_correct,
    'guess_number', existing_attempts + 1,
    'attempts_remaining', 6 - (existing_attempts + 1),
    'target', case when is_correct or existing_attempts + 1 >= 6 then target else null end
  );
end;
$_$;


--
-- Name: wordle_today_word(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.wordle_today_word() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select word from public.wordle_words
  order by id
  offset (
    (extract(epoch from current_date)::bigint / 86400)
    % (select count(*) from public.wordle_words)
  )
  limit 1;
$$;


--
-- Name: accessory_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accessory_catalog (
    key text NOT NULL,
    emoji text NOT NULL,
    name text NOT NULL,
    price integer NOT NULL
);


--
-- Name: achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.achievements (
    key text NOT NULL,
    label text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    builtin boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT achievements_label_check CHECK (((length(TRIM(BOTH FROM label)) >= 1) AND (length(TRIM(BOTH FROM label)) <= 40)))
);


--
-- Name: bet_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bet_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bet_id uuid NOT NULL,
    label text NOT NULL
);


--
-- Name: bet_wagers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bet_wagers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bet_id uuid NOT NULL,
    option_id uuid NOT NULL,
    user_id uuid NOT NULL,
    amount integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bet_wagers_amount_check CHECK ((amount > 0))
);


--
-- Name: bets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    creator_id uuid NOT NULL,
    title text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    winning_option_id uuid,
    closes_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bets_status_check CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text, 'cancelled'::text])))
);


--
-- Name: birthday_email_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.birthday_email_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    birthday_on date NOT NULL,
    kind text NOT NULL,
    status text DEFAULT 'sending'::text NOT NULL,
    recipients integer DEFAULT 0 NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT birthday_email_log_kind_check CHECK ((kind = ANY (ARRAY['announcement'::text, 'personal'::text]))),
    CONSTRAINT birthday_email_log_status_check CHECK ((status = ANY (ARRAY['sending'::text, 'sent'::text, 'failed'::text])))
);


--
-- Name: birthday_email_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.birthday_email_settings (
    id smallint DEFAULT 1 NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    from_name text DEFAULT 'C9MYR Hub'::text NOT NULL,
    from_email text DEFAULT ''::text NOT NULL,
    reply_to text DEFAULT ''::text NOT NULL,
    subject text DEFAULT 'Happy birthday, {{names}}! 🎂'::text NOT NULL,
    body text DEFAULT 'Hi team,

Today is {{names}}''s birthday! 🎉

Drop by the hub and leave them a birthday wish:
{{site_url}}/birthdays

Have a great day,
C9MYR Hub'::text NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    personal_enabled boolean DEFAULT false NOT NULL,
    personal_subject text DEFAULT 'Happy birthday, {{name}}! 🎂'::text NOT NULL,
    personal_body text DEFAULT 'Hi {{name}},

Happy birthday from all of us! 🎉 We hope your day is as awesome as you are.

Your teammates are leaving you wishes on the hub:
{{site_url}}/birthdays

Enjoy your day,
C9MYR Hub'::text NOT NULL,
    site_url text DEFAULT ''::text NOT NULL,
    send_hour smallint DEFAULT 8 NOT NULL,
    timezone text DEFAULT 'Asia/Kuala_Lumpur'::text NOT NULL,
    CONSTRAINT birthday_email_settings_id_check CHECK ((id = 1)),
    CONSTRAINT birthday_email_settings_send_hour_check CHECK (((send_hour >= 0) AND (send_hour <= 23)))
);


--
-- Name: birthday_notification_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.birthday_notification_log (
    profile_id uuid NOT NULL,
    birthday_on date NOT NULL,
    notified_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: border_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.border_catalog (
    key text NOT NULL,
    name text NOT NULL,
    price integer NOT NULL
);


--
-- Name: challenge_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    challenge_id uuid NOT NULL,
    actor_id uuid,
    kind text NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: challenge_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_participants (
    challenge_id uuid NOT NULL,
    user_id uuid NOT NULL,
    side text NOT NULL,
    is_captain boolean DEFAULT false NOT NULL,
    accepted_at timestamp with time zone,
    baseline numeric,
    target numeric,
    current_value numeric,
    CONSTRAINT challenge_participants_side_check CHECK ((side = ANY (ARRAY['A'::text, 'B'::text])))
);


--
-- Name: challenge_score_updates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_score_updates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    challenge_id uuid NOT NULL,
    user_id uuid NOT NULL,
    value numeric NOT NULL,
    proof_path text NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: challenge_terms_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_terms_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    challenge_id uuid NOT NULL,
    version integer NOT NULL,
    action text NOT NULL,
    actor_id uuid,
    terms jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    creator_id uuid NOT NULL,
    opponent_id uuid,
    topic text NOT NULL,
    description text,
    reward text,
    punishment text,
    metric text,
    status text DEFAULT 'pending'::text NOT NULL,
    score_creator integer DEFAULT 0 NOT NULL,
    score_opponent integer DEFAULT 0 NOT NULL,
    winner_id uuid,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    pk_version smallint DEFAULT 0 NOT NULL,
    method text,
    format text,
    pk_type text,
    department text,
    metric_definition text,
    direction text,
    scoring text,
    winning_target numeric,
    update_frequency text,
    pk_money numeric(10,2) DEFAULT 0 NOT NULL,
    proof_method text,
    tiebreaker text,
    compliance_agreed boolean DEFAULT false NOT NULL,
    counter_round smallint DEFAULT 0 NOT NULL,
    terms_version integer DEFAULT 1 NOT NULL,
    expires_at timestamp with time zone,
    approved_by uuid,
    approved_at timestamp with time zone,
    review_note text,
    winner_side text,
    final_score_a numeric,
    final_score_b numeric,
    early_settlement boolean DEFAULT false NOT NULL,
    settlement_requested_by uuid,
    settlement_requested_at timestamp with time zone,
    settled_by uuid,
    settled_at timestamp with time zone,
    terminated_reason text,
    terminated_note text,
    terminated_by uuid,
    terminated_at timestamp with time zone,
    CONSTRAINT challenges_check CHECK (((opponent_id IS NULL) OR (creator_id <> opponent_id))),
    CONSTRAINT challenges_direction_check CHECK ((direction = ANY (ARRAY['higher'::text, 'lower'::text]))),
    CONSTRAINT challenges_format_check CHECK ((format = ANY (ARRAY['head_to_head'::text, 'self_declaration'::text]))),
    CONSTRAINT challenges_method_check CHECK ((method = ANY (ARRAY['named'::text, 'open'::text]))),
    CONSTRAINT challenges_pk_money_check CHECK ((pk_money >= (0)::numeric)),
    CONSTRAINT challenges_pk_type_check CHECK ((pk_type = ANY (ARRAY['one_v_one'::text, 'vs_upline'::text, 'team'::text]))),
    CONSTRAINT challenges_scoring_check CHECK ((scoring = ANY (ARRAY['absolute'::text, 'improvement'::text, 'completion'::text]))),
    CONSTRAINT challenges_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'completed'::text, 'declined'::text, 'awaiting_opponent'::text, 'countered'::text, 'awaiting_approval'::text, 'rejected'::text, 'cancelled'::text, 'expired'::text, 'settlement_requested'::text, 'awaiting_playbook'::text, 'awaiting_verification'::text, 'settled'::text, 'terminated'::text]))),
    CONSTRAINT challenges_terminated_reason_check CHECK ((terminated_reason = ANY (ARRAY['resignation'::text, 'transfer'::text, 'data_failure'::text, 'customer_pool_change'::text, 'emergency'::text, 'other'::text]))),
    CONSTRAINT challenges_winner_side_check CHECK ((winner_side = ANY (ARRAY['A'::text, 'B'::text])))
);


--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    target_type text NOT NULL,
    target_id text NOT NULL,
    author_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    parent_comment_id uuid,
    CONSTRAINT comments_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 1000)))
);


--
-- Name: direct_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.direct_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    body text NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT direct_messages_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 2000)))
);


--
-- Name: dm_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dm_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_a uuid NOT NULL,
    user_b uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_message_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dm_conversations_check CHECK ((user_a <> user_b)),
    CONSTRAINT dm_conversations_check1 CHECK ((user_a < user_b))
);


--
-- Name: goal_updates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goal_updates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    goal_id uuid NOT NULL,
    author_id uuid NOT NULL,
    progress integer NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT goal_updates_progress_check CHECK (((progress >= 0) AND (progress <= 100)))
);


--
-- Name: goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    term text NOT NULL,
    target_date date,
    progress integer DEFAULT 0 NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    category text DEFAULT 'personal'::text NOT NULL,
    accountability text,
    action_plan text,
    CONSTRAINT goals_category_check CHECK ((category = ANY (ARRAY['personal'::text, 'career'::text]))),
    CONSTRAINT goals_progress_check CHECK (((progress >= 0) AND (progress <= 100))),
    CONSTRAINT goals_term_check CHECK ((term = ANY (ARRAY['short'::text, 'mid'::text, 'long'::text])))
);


--
-- Name: hof_award_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hof_award_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    department text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hof_award_categories_department_check CHECK ((length(TRIM(BOTH FROM department)) > 0)),
    CONSTRAINT hof_award_categories_name_check CHECK (((length(TRIM(BOTH FROM name)) >= 1) AND (length(TRIM(BOTH FROM name)) <= 100)))
);


--
-- Name: hof_award_winners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hof_award_winners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid NOT NULL,
    month date NOT NULL,
    rank integer NOT NULL,
    user_id uuid NOT NULL,
    achievement text DEFAULT ''::text NOT NULL,
    CONSTRAINT hof_award_winners_achievement_check CHECK ((length(achievement) <= 150)),
    CONSTRAINT hof_award_winners_month_check CHECK ((EXTRACT(day FROM month) = (1)::numeric)),
    CONSTRAINT hof_award_winners_rank_check CHECK (((rank >= 1) AND (rank <= 3)))
);


--
-- Name: hof_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hof_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    icon text DEFAULT 'Trophy'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hof_deletion_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hof_deletion_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deleted_by_name text,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    snapshot jsonb NOT NULL
);


--
-- Name: hof_podium_exclusions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hof_podium_exclusions (
    user_id uuid NOT NULL,
    excluded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hof_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hof_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid NOT NULL,
    holder_id uuid NOT NULL,
    achievement text NOT NULL,
    record_date date DEFAULT CURRENT_DATE NOT NULL,
    is_current boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hof_records_achievement_check CHECK (((char_length(achievement) >= 1) AND (char_length(achievement) <= 300)))
);


--
-- Name: login_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    last_heartbeat_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone
);


--
-- Name: mentorships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mentorships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mentor_id uuid NOT NULL,
    mentee_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mentorships_status_check CHECK ((status = ANY (ARRAY['active'::text, 'graduated'::text])))
);


--
-- Name: mission_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_activity (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    kind text NOT NULL,
    ref_id text,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mission_activity_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.mission_activity ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.mission_activity_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: mission_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mission_id uuid NOT NULL,
    user_id uuid NOT NULL,
    period_start date NOT NULL,
    status text NOT NULL,
    points integer NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mission_claims_status_check CHECK ((status = ANY (ARRAY['awarded'::text, 'pending'::text, 'rejected'::text])))
);


--
-- Name: missions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.missions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    cadence text NOT NULL,
    kind text NOT NULL,
    target_count integer DEFAULT 1 NOT NULL,
    points integer NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT missions_cadence_check CHECK ((cadence = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'special'::text]))),
    CONSTRAINT missions_points_check CHECK ((points > 0)),
    CONSTRAINT missions_target_count_check CHECK ((target_count > 0)),
    CONSTRAINT missions_title_check CHECK ((length(TRIM(BOTH FROM title)) > 0))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    actor_id uuid,
    type text NOT NULL,
    target_type text,
    target_id text,
    message text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: org_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_departments (
    name text NOT NULL,
    sort integer NOT NULL,
    CONSTRAINT org_departments_name_check CHECK (((length(TRIM(BOTH FROM name)) >= 1) AND (length(TRIM(BOTH FROM name)) <= 40)))
);


--
-- Name: org_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_roles (
    name text NOT NULL,
    rank integer NOT NULL,
    CONSTRAINT org_roles_name_check CHECK (((length(TRIM(BOTH FROM name)) >= 1) AND (length(TRIM(BOTH FROM name)) <= 40)))
);


--
-- Name: pk_money_debts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pk_money_debts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    challenge_id uuid NOT NULL,
    debtor_id uuid NOT NULL,
    creditor_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pk_money_debts_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: pk_playbooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pk_playbooks (
    challenge_id uuid NOT NULL,
    author_id uuid,
    what_extra text NOT NULL,
    what_worked text NOT NULL,
    how_to_copy text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pk_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pk_points (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    points numeric(5,1) NOT NULL,
    outcome text NOT NULL,
    department text,
    period_start date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pk_points_outcome_check CHECK ((outcome = ANY (ARRAY['win'::text, 'loss'::text, 'draw'::text])))
);


--
-- Name: pk_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pk_settings (
    id smallint DEFAULT 1 NOT NULL,
    max_one_v_one smallint DEFAULT 3 NOT NULL,
    max_team smallint DEFAULT 1 NOT NULL,
    max_vs_upline smallint DEFAULT 1 NOT NULL,
    max_total smallint DEFAULT 5 NOT NULL,
    open_expiry_days smallint DEFAULT 7 NOT NULL,
    max_counter_rounds smallint DEFAULT 2 NOT NULL,
    money_limit_default numeric(10,2) DEFAULT 50 NOT NULL,
    money_limit_atl_tl numeric(10,2) DEFAULT 100 NOT NULL,
    money_limit_above_tl numeric(10,2) DEFAULT 200 NOT NULL,
    CONSTRAINT pk_settings_id_check CHECK ((id = 1))
);


--
-- Name: point_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.point_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount integer NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: points_maintenance_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.points_maintenance_log (
    key text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: points_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.points_settings (
    id smallint DEFAULT 1 NOT NULL,
    revamp_enabled boolean DEFAULT false NOT NULL,
    timezone text DEFAULT 'Asia/Kuala_Lumpur'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT points_settings_id_check CHECK ((id = 1))
);


--
-- Name: posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    author_id uuid NOT NULL,
    body text,
    image_path text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    CONSTRAINT posts_category_check CHECK ((category = ANY (ARRAY['general'::text, 'desk_setup'::text]))),
    CONSTRAINT posts_has_content CHECK (((body IS NOT NULL) OR (image_path IS NOT NULL)))
);


--
-- Name: progress_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.progress_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    target_type text NOT NULL,
    target_id uuid NOT NULL,
    uploader_id uuid NOT NULL,
    image_path text NOT NULL,
    caption text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT progress_photos_target_type_check CHECK ((target_type = ANY (ARRAY['goal'::text, 'challenge'::text])))
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quiz_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    question_id uuid NOT NULL,
    selected_index integer NOT NULL,
    correct boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quiz_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question text NOT NULL,
    options text[] NOT NULL,
    correct_index integer NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quiz_questions_correct_index_check CHECK (((correct_index >= 0) AND (correct_index <= 3))),
    CONSTRAINT quiz_questions_options_check CHECK ((array_length(options, 1) = 4))
);


--
-- Name: reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    target_type text NOT NULL,
    target_id text NOT NULL,
    user_id uuid NOT NULL,
    emoji text DEFAULT '👍'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reward_redemptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reward_redemptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reward_id uuid,
    reward_name text NOT NULL,
    user_id uuid NOT NULL,
    cost integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_note text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reward_redemptions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'fulfilled'::text, 'rejected'::text])))
);


--
-- Name: rewards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rewards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    cost integer NOT NULL,
    stock integer,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rewards_cost_check CHECK ((cost > 0)),
    CONSTRAINT rewards_name_check CHECK ((length(TRIM(BOTH FROM name)) > 0)),
    CONSTRAINT rewards_stock_check CHECK (((stock IS NULL) OR (stock >= 0)))
);


--
-- Name: voice_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voice_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    channel_id text NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    left_at timestamp with time zone
);


--
-- Name: wordle_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wordle_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    play_date date DEFAULT CURRENT_DATE NOT NULL,
    guess_number integer NOT NULL,
    guess text NOT NULL,
    statuses text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wordle_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wordle_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    play_date date NOT NULL,
    solved boolean NOT NULL,
    guess_count integer NOT NULL,
    duration_seconds integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wordle_valid_guesses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wordle_valid_guesses (
    word text NOT NULL
);


--
-- Name: wordle_words; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wordle_words (
    id integer NOT NULL,
    word text NOT NULL,
    CONSTRAINT wordle_words_word_check CHECK (((char_length(word) = 5) AND (word = lower(word))))
);


--
-- Name: wordle_words_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wordle_words_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wordle_words_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wordle_words_id_seq OWNED BY public.wordle_words.id;


--
-- Name: wordle_words id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wordle_words ALTER COLUMN id SET DEFAULT nextval('public.wordle_words_id_seq'::regclass);


--
-- Name: accessory_catalog accessory_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_catalog
    ADD CONSTRAINT accessory_catalog_pkey PRIMARY KEY (key);


--
-- Name: achievements achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_pkey PRIMARY KEY (key);


--
-- Name: bet_options bet_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bet_options
    ADD CONSTRAINT bet_options_pkey PRIMARY KEY (id);


--
-- Name: bet_wagers bet_wagers_bet_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bet_wagers
    ADD CONSTRAINT bet_wagers_bet_id_user_id_key UNIQUE (bet_id, user_id);


--
-- Name: bet_wagers bet_wagers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bet_wagers
    ADD CONSTRAINT bet_wagers_pkey PRIMARY KEY (id);


--
-- Name: bets bets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bets
    ADD CONSTRAINT bets_pkey PRIMARY KEY (id);


--
-- Name: birthday_email_log birthday_email_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.birthday_email_log
    ADD CONSTRAINT birthday_email_log_pkey PRIMARY KEY (id);


--
-- Name: birthday_email_log birthday_email_log_profile_id_birthday_on_kind_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.birthday_email_log
    ADD CONSTRAINT birthday_email_log_profile_id_birthday_on_kind_key UNIQUE (profile_id, birthday_on, kind);


--
-- Name: birthday_email_settings birthday_email_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.birthday_email_settings
    ADD CONSTRAINT birthday_email_settings_pkey PRIMARY KEY (id);


--
-- Name: birthday_notification_log birthday_notification_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.birthday_notification_log
    ADD CONSTRAINT birthday_notification_log_pkey PRIMARY KEY (profile_id, birthday_on);


--
-- Name: border_catalog border_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.border_catalog
    ADD CONSTRAINT border_catalog_pkey PRIMARY KEY (key);


--
-- Name: challenge_events challenge_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_events
    ADD CONSTRAINT challenge_events_pkey PRIMARY KEY (id);


--
-- Name: challenge_participants challenge_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_participants
    ADD CONSTRAINT challenge_participants_pkey PRIMARY KEY (challenge_id, user_id);


--
-- Name: challenge_score_updates challenge_score_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_score_updates
    ADD CONSTRAINT challenge_score_updates_pkey PRIMARY KEY (id);


--
-- Name: challenge_terms_history challenge_terms_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_terms_history
    ADD CONSTRAINT challenge_terms_history_pkey PRIMARY KEY (id);


--
-- Name: challenges challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: direct_messages direct_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT direct_messages_pkey PRIMARY KEY (id);


--
-- Name: dm_conversations dm_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_conversations
    ADD CONSTRAINT dm_conversations_pkey PRIMARY KEY (id);


--
-- Name: dm_conversations dm_conversations_user_a_user_b_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_conversations
    ADD CONSTRAINT dm_conversations_user_a_user_b_key UNIQUE (user_a, user_b);


--
-- Name: goal_updates goal_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_updates
    ADD CONSTRAINT goal_updates_pkey PRIMARY KEY (id);


--
-- Name: goals goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_pkey PRIMARY KEY (id);


--
-- Name: hof_award_categories hof_award_categories_department_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hof_award_categories
    ADD CONSTRAINT hof_award_categories_department_name_key UNIQUE (department, name);


--
-- Name: hof_award_categories hof_award_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hof_award_categories
    ADD CONSTRAINT hof_award_categories_pkey PRIMARY KEY (id);


--
-- Name: hof_award_winners hof_award_winners_category_id_month_rank_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hof_award_winners
    ADD CONSTRAINT hof_award_winners_category_id_month_rank_key UNIQUE (category_id, month, rank);


--
-- Name: hof_award_winners hof_award_winners_category_id_month_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hof_award_winners
    ADD CONSTRAINT hof_award_winners_category_id_month_user_id_key UNIQUE (category_id, month, user_id);


--
-- Name: hof_award_winners hof_award_winners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hof_award_winners
    ADD CONSTRAINT hof_award_winners_pkey PRIMARY KEY (id);


--
-- Name: hof_categories hof_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hof_categories
    ADD CONSTRAINT hof_categories_pkey PRIMARY KEY (id);


--
-- Name: hof_deletion_logs hof_deletion_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hof_deletion_logs
    ADD CONSTRAINT hof_deletion_logs_pkey PRIMARY KEY (id);


--
-- Name: hof_podium_exclusions hof_podium_exclusions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hof_podium_exclusions
    ADD CONSTRAINT hof_podium_exclusions_pkey PRIMARY KEY (user_id);


--
-- Name: hof_records hof_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hof_records
    ADD CONSTRAINT hof_records_pkey PRIMARY KEY (id);


--
-- Name: login_sessions login_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_sessions
    ADD CONSTRAINT login_sessions_pkey PRIMARY KEY (id);


--
-- Name: mentorships mentorships_mentor_id_mentee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentorships
    ADD CONSTRAINT mentorships_mentor_id_mentee_id_key UNIQUE (mentor_id, mentee_id);


--
-- Name: mentorships mentorships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentorships
    ADD CONSTRAINT mentorships_pkey PRIMARY KEY (id);


--
-- Name: mission_activity mission_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_activity
    ADD CONSTRAINT mission_activity_pkey PRIMARY KEY (id);


--
-- Name: mission_claims mission_claims_mission_id_user_id_period_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_claims
    ADD CONSTRAINT mission_claims_mission_id_user_id_period_start_key UNIQUE (mission_id, user_id, period_start);


--
-- Name: mission_claims mission_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_claims
    ADD CONSTRAINT mission_claims_pkey PRIMARY KEY (id);


--
-- Name: missions missions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: org_departments org_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_departments
    ADD CONSTRAINT org_departments_pkey PRIMARY KEY (name);


--
-- Name: org_roles org_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_roles
    ADD CONSTRAINT org_roles_pkey PRIMARY KEY (name);


--
-- Name: pk_money_debts pk_money_debts_challenge_id_debtor_id_creditor_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pk_money_debts
    ADD CONSTRAINT pk_money_debts_challenge_id_debtor_id_creditor_id_key UNIQUE (challenge_id, debtor_id, creditor_id);


--
-- Name: pk_money_debts pk_money_debts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pk_money_debts
    ADD CONSTRAINT pk_money_debts_pkey PRIMARY KEY (id);


--
-- Name: pk_playbooks pk_playbooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pk_playbooks
    ADD CONSTRAINT pk_playbooks_pkey PRIMARY KEY (challenge_id);


--
-- Name: pk_points pk_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pk_points
    ADD CONSTRAINT pk_points_pkey PRIMARY KEY (id);


--
-- Name: pk_points pk_points_user_id_challenge_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pk_points
    ADD CONSTRAINT pk_points_user_id_challenge_id_key UNIQUE (user_id, challenge_id);


--
-- Name: pk_settings pk_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pk_settings
    ADD CONSTRAINT pk_settings_pkey PRIMARY KEY (id);


--
-- Name: point_transactions point_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_pkey PRIMARY KEY (id);


--
-- Name: points_maintenance_log points_maintenance_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.points_maintenance_log
    ADD CONSTRAINT points_maintenance_log_pkey PRIMARY KEY (key);


--
-- Name: points_settings points_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.points_settings
    ADD CONSTRAINT points_settings_pkey PRIMARY KEY (id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: progress_photos progress_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progress_photos
    ADD CONSTRAINT progress_photos_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: quiz_answers quiz_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_answers
    ADD CONSTRAINT quiz_answers_pkey PRIMARY KEY (id);


--
-- Name: quiz_answers quiz_answers_user_id_question_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_answers
    ADD CONSTRAINT quiz_answers_user_id_question_id_key UNIQUE (user_id, question_id);


--
-- Name: quiz_questions quiz_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_questions
    ADD CONSTRAINT quiz_questions_pkey PRIMARY KEY (id);


--
-- Name: reactions reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_pkey PRIMARY KEY (id);


--
-- Name: reactions reactions_target_type_target_id_user_id_emoji_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_target_type_target_id_user_id_emoji_key UNIQUE (target_type, target_id, user_id, emoji);


--
-- Name: reward_redemptions reward_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_redemptions
    ADD CONSTRAINT reward_redemptions_pkey PRIMARY KEY (id);


--
-- Name: rewards rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards
    ADD CONSTRAINT rewards_pkey PRIMARY KEY (id);


--
-- Name: voice_sessions voice_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_sessions
    ADD CONSTRAINT voice_sessions_pkey PRIMARY KEY (id);


--
-- Name: wordle_attempts wordle_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wordle_attempts
    ADD CONSTRAINT wordle_attempts_pkey PRIMARY KEY (id);


--
-- Name: wordle_attempts wordle_attempts_user_id_play_date_guess_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wordle_attempts
    ADD CONSTRAINT wordle_attempts_user_id_play_date_guess_number_key UNIQUE (user_id, play_date, guess_number);


--
-- Name: wordle_results wordle_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wordle_results
    ADD CONSTRAINT wordle_results_pkey PRIMARY KEY (id);


--
-- Name: wordle_results wordle_results_user_id_play_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wordle_results
    ADD CONSTRAINT wordle_results_user_id_play_date_key UNIQUE (user_id, play_date);


--
-- Name: wordle_valid_guesses wordle_valid_guesses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wordle_valid_guesses
    ADD CONSTRAINT wordle_valid_guesses_pkey PRIMARY KEY (word);


--
-- Name: wordle_words wordle_words_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wordle_words
    ADD CONSTRAINT wordle_words_pkey PRIMARY KEY (id);


--
-- Name: wordle_words wordle_words_word_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wordle_words
    ADD CONSTRAINT wordle_words_word_key UNIQUE (word);


--
-- Name: challenge_events_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX challenge_events_idx ON public.challenge_events USING btree (challenge_id, created_at);


--
-- Name: challenge_participants_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX challenge_participants_user_idx ON public.challenge_participants USING btree (user_id);


--
-- Name: challenge_score_updates_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX challenge_score_updates_idx ON public.challenge_score_updates USING btree (challenge_id, created_at);


--
-- Name: challenges_pk_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX challenges_pk_status_idx ON public.challenges USING btree (pk_version, status);


--
-- Name: comments_parent_comment_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX comments_parent_comment_id_idx ON public.comments USING btree (parent_comment_id);


--
-- Name: comments_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX comments_target_idx ON public.comments USING btree (target_type, target_id, created_at);


--
-- Name: direct_messages_conversation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX direct_messages_conversation_idx ON public.direct_messages USING btree (conversation_id, created_at);


--
-- Name: goal_updates_goal_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX goal_updates_goal_id_idx ON public.goal_updates USING btree (goal_id, created_at DESC);


--
-- Name: hof_records_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hof_records_category_idx ON public.hof_records USING btree (category_id, is_current);


--
-- Name: login_sessions_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX login_sessions_user_id_idx ON public.login_sessions USING btree (user_id, started_at DESC);


--
-- Name: mission_activity_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_activity_lookup ON public.mission_activity USING btree (user_id, kind, occurred_at);


--
-- Name: notifications_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_idx ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: pk_points_period_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pk_points_period_idx ON public.pk_points USING btree (period_start, department);


--
-- Name: point_transactions_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX point_transactions_user_idx ON public.point_transactions USING btree (user_id, created_at DESC);


--
-- Name: profiles_username_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_username_key ON public.profiles USING btree (username) WHERE (username IS NOT NULL);


--
-- Name: progress_photos_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX progress_photos_target_idx ON public.progress_photos USING btree (target_type, target_id);


--
-- Name: push_subscriptions_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_subscriptions_user_id_idx ON public.push_subscriptions USING btree (user_id);


--
-- Name: reactions_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reactions_target_idx ON public.reactions USING btree (target_type, target_id);


--
-- Name: voice_sessions_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX voice_sessions_user_id_idx ON public.voice_sessions USING btree (user_id, joined_at DESC);


--
-- Name: challenges challenges_pk_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER challenges_pk_guard BEFORE DELETE OR UPDATE ON public.challenges FOR EACH ROW EXECUTE FUNCTION public.pk_guard_legacy();


--
-- Name: challenges challenges_pk_money; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER challenges_pk_money AFTER UPDATE ON public.challenges FOR EACH ROW EXECUTE FUNCTION public.pk_record_debts();


--
-- Name: point_transactions guard_point_transaction; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_point_transaction BEFORE INSERT ON public.point_transactions FOR EACH ROW EXECUTE FUNCTION public.guard_point_transaction();


--
-- Name: hof_categories guinness_categories_audit_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guinness_categories_audit_delete BEFORE DELETE ON public.hof_categories FOR EACH ROW EXECUTE FUNCTION public.hof_audit_delete();


--
-- Name: hof_award_categories hof_categories_audit_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER hof_categories_audit_delete BEFORE DELETE ON public.hof_award_categories FOR EACH ROW EXECUTE FUNCTION public.hof_audit_delete();


--
-- Name: hof_records hof_records_audit_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER hof_records_audit_delete BEFORE DELETE ON public.hof_records FOR EACH ROW EXECUTE FUNCTION public.hof_audit_delete();


--
-- Name: hof_award_winners hof_winners_audit_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER hof_winners_audit_delete BEFORE DELETE ON public.hof_award_winners FOR EACH ROW EXECUTE FUNCTION public.hof_audit_delete();


--
-- Name: comments mission_activity_birthday_wish; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_activity_birthday_wish AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.log_mission_activity('birthday_wish', 'author_id', 'target_id');


--
-- Name: comments mission_activity_comment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_activity_comment AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.log_mission_activity('comment', 'author_id', '');


--
-- Name: goals mission_activity_goal_complete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_activity_goal_complete AFTER UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.log_mission_activity('goal_complete', 'owner_id', '');


--
-- Name: goals mission_activity_goal_create; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_activity_goal_create AFTER INSERT ON public.goals FOR EACH ROW EXECUTE FUNCTION public.log_mission_activity('goal_create', 'owner_id', '');


--
-- Name: goal_updates mission_activity_goal_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_activity_goal_update AFTER INSERT ON public.goal_updates FOR EACH ROW EXECUTE FUNCTION public.log_mission_activity('goal_update', 'author_id', '');


--
-- Name: login_sessions mission_activity_login; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_activity_login AFTER INSERT ON public.login_sessions FOR EACH ROW EXECUTE FUNCTION public.log_mission_activity('login', 'user_id', '');


--
-- Name: direct_messages mission_activity_message; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_activity_message AFTER INSERT ON public.direct_messages FOR EACH ROW EXECUTE FUNCTION public.log_mission_activity('message', 'sender_id', '');


--
-- Name: posts mission_activity_post; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_activity_post AFTER INSERT ON public.posts FOR EACH ROW EXECUTE FUNCTION public.log_mission_activity('post', 'author_id', '');


--
-- Name: progress_photos mission_activity_progress_photo; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_activity_progress_photo AFTER INSERT ON public.progress_photos FOR EACH ROW EXECUTE FUNCTION public.log_mission_activity('progress_photo', 'uploader_id', '');


--
-- Name: quiz_answers mission_activity_quiz_correct; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_activity_quiz_correct AFTER INSERT ON public.quiz_answers FOR EACH ROW EXECUTE FUNCTION public.log_mission_activity('quiz_correct', 'user_id', 'question_id');


--
-- Name: reactions mission_activity_reaction; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_activity_reaction AFTER INSERT ON public.reactions FOR EACH ROW EXECUTE FUNCTION public.log_mission_activity('reaction', 'user_id', 'target_id');


--
-- Name: voice_sessions mission_activity_voice_join; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_activity_voice_join AFTER INSERT ON public.voice_sessions FOR EACH ROW EXECUTE FUNCTION public.log_mission_activity('voice_join', 'user_id', '');


--
-- Name: wordle_results mission_activity_wordle_solve; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_activity_wordle_solve AFTER INSERT OR UPDATE ON public.wordle_results FOR EACH ROW EXECUTE FUNCTION public.log_mission_activity('wordle_solve', 'user_id', '');


--
-- Name: comments notify_on_comment_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notify_on_comment_trigger AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();


--
-- Name: reactions notify_on_reaction_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notify_on_reaction_trigger AFTER INSERT ON public.reactions FOR EACH ROW EXECUTE FUNCTION public.notify_on_reaction();


--
-- Name: achievements on_achievement_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_achievement_delete AFTER DELETE ON public.achievements FOR EACH ROW EXECUTE FUNCTION public.remove_deleted_achievement();


--
-- Name: birthday_email_settings on_birthday_email_settings_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_birthday_email_settings_update BEFORE UPDATE ON public.birthday_email_settings FOR EACH ROW EXECUTE FUNCTION public.birthday_email_settings_stamp();


--
-- Name: comments on_comment_reply; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_comment_reply AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.notify_comment_reply();


--
-- Name: goals on_goal_completed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_goal_completed AFTER UPDATE OF completed ON public.goals FOR EACH ROW EXECUTE FUNCTION public.notify_goal_completed();


--
-- Name: hof_records on_hof_record_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_hof_record_insert AFTER INSERT ON public.hof_records FOR EACH ROW EXECUTE FUNCTION public.award_hof_record_points();


--
-- Name: notifications on_notification_push; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_notification_push AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.push_new_notification();


--
-- Name: point_transactions on_point_transaction_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_point_transaction_insert AFTER INSERT ON public.point_transactions FOR EACH ROW EXECUTE FUNCTION public.apply_point_transaction();


--
-- Name: profiles on_profile_rewards; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_profile_rewards AFTER UPDATE OF points, unlocked_titles ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.notify_profile_rewards();


--
-- Name: profiles protect_birthday_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER protect_birthday_trigger BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_birthday_field();


--
-- Name: profiles protect_role_department_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER protect_role_department_trigger BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_role_department_fields();


--
-- Name: profiles validate_role_department; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_role_department BEFORE INSERT OR UPDATE OF role, department ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.validate_role_department();


--
-- Name: bet_options bet_options_bet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bet_options
    ADD CONSTRAINT bet_options_bet_id_fkey FOREIGN KEY (bet_id) REFERENCES public.bets(id) ON DELETE CASCADE;


--
-- Name: bet_wagers bet_wagers_bet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bet_wagers
    ADD CONSTRAINT bet_wagers_bet_id_fkey FOREIGN KEY (bet_id) REFERENCES public.bets(id) ON DELETE CASCADE;


--
-- Name: bet_wagers bet_wagers_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bet_wagers
    ADD CONSTRAINT bet_wagers_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.bet_options(id) ON DELETE CASCADE;


--
-- Name: bet_wagers bet_wagers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bet_wagers
    ADD CONSTRAINT bet_wagers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: bets bets_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bets
    ADD CONSTRAINT bets_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: birthday_email_log birthday_email_log_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.birthday_email_log
    ADD CONSTRAINT birthday_email_log_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: birthday_email_settings birthday_email_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.birthday_email_settings
    ADD CONSTRAINT birthday_email_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: birthday_notification_log birthday_notification_log_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.birthday_notification_log
    ADD CONSTRAINT birthday_notification_log_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: challenge_events challenge_events_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_events
    ADD CONSTRAINT challenge_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: challenge_events challenge_events_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_events
    ADD CONSTRAINT challenge_events_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;


--
-- Name: challenge_participants challenge_participants_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_participants
    ADD CONSTRAINT challenge_participants_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;


--
-- Name: challenge_participants challenge_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_participants
    ADD CONSTRAINT challenge_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: challenge_score_updates challenge_score_updates_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_score_updates
    ADD CONSTRAINT challenge_score_updates_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;


--
-- Name: challenge_score_updates challenge_score_updates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_score_updates
    ADD CONSTRAINT challenge_score_updates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: challenge_terms_history challenge_terms_history_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_terms_history
    ADD CONSTRAINT challenge_terms_history_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: challenge_terms_history challenge_terms_history_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_terms_history
    ADD CONSTRAINT challenge_terms_history_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;


--
-- Name: challenges challenges_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: challenges challenges_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: challenges challenges_opponent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_opponent_id_fkey FOREIGN KEY (opponent_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: challenges challenges_settled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_settled_by_fkey FOREIGN KEY (settled_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: challenges challenges_settlement_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_settlement_requested_by_fkey FOREIGN KEY (settlement_requested_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: challenges challenges_terminated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_terminated_by_fkey FOREIGN KEY (terminated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: challenges challenges_winner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.profiles(id);


--
-- Name: comments comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: comments comments_parent_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.comments(id) ON DELETE CASCADE;


--
-- Name: direct_messages direct_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT direct_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.dm_conversations(id) ON DELETE CASCADE;


--
-- Name: direct_messages direct_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT direct_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: dm_conversations dm_conversations_user_a_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_conversations
    ADD CONSTRAINT dm_conversations_user_a_fkey FOREIGN KEY (user_a) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: dm_conversations dm_conversations_user_b_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_conversations
    ADD CONSTRAINT dm_conversations_user_b_fkey FOREIGN KEY (user_b) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: goal_updates goal_updates_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_updates
    ADD CONSTRAINT goal_updates_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: goal_updates goal_updates_goal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_updates
    ADD CONSTRAINT goal_updates_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.goals(id) ON DELETE CASCADE;


--
-- Name: goals goals_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: hof_award_winners hof_award_winners_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hof_award_winners
    ADD CONSTRAINT hof_award_winners_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.hof_award_categories(id) ON DELETE CASCADE;


--
-- Name: hof_award_winners hof_award_winners_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hof_award_winners
    ADD CONSTRAINT hof_award_winners_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: hof_podium_exclusions hof_podium_exclusions_excluded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hof_podium_exclusions
    ADD CONSTRAINT hof_podium_exclusions_excluded_by_fkey FOREIGN KEY (excluded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: hof_podium_exclusions hof_podium_exclusions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hof_podium_exclusions
    ADD CONSTRAINT hof_podium_exclusions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: hof_records hof_records_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hof_records
    ADD CONSTRAINT hof_records_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.hof_categories(id) ON DELETE CASCADE;


--
-- Name: hof_records hof_records_holder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hof_records
    ADD CONSTRAINT hof_records_holder_id_fkey FOREIGN KEY (holder_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: login_sessions login_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_sessions
    ADD CONSTRAINT login_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: mentorships mentorships_mentee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentorships
    ADD CONSTRAINT mentorships_mentee_id_fkey FOREIGN KEY (mentee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: mentorships mentorships_mentor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentorships
    ADD CONSTRAINT mentorships_mentor_id_fkey FOREIGN KEY (mentor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: mission_activity mission_activity_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_activity
    ADD CONSTRAINT mission_activity_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: mission_claims mission_claims_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_claims
    ADD CONSTRAINT mission_claims_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE;


--
-- Name: mission_claims mission_claims_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_claims
    ADD CONSTRAINT mission_claims_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: mission_claims mission_claims_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_claims
    ADD CONSTRAINT mission_claims_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: missions missions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: pk_money_debts pk_money_debts_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pk_money_debts
    ADD CONSTRAINT pk_money_debts_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;


--
-- Name: pk_money_debts pk_money_debts_creditor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pk_money_debts
    ADD CONSTRAINT pk_money_debts_creditor_id_fkey FOREIGN KEY (creditor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: pk_money_debts pk_money_debts_debtor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pk_money_debts
    ADD CONSTRAINT pk_money_debts_debtor_id_fkey FOREIGN KEY (debtor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: pk_playbooks pk_playbooks_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pk_playbooks
    ADD CONSTRAINT pk_playbooks_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: pk_playbooks pk_playbooks_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pk_playbooks
    ADD CONSTRAINT pk_playbooks_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;


--
-- Name: pk_points pk_points_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pk_points
    ADD CONSTRAINT pk_points_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;


--
-- Name: pk_points pk_points_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pk_points
    ADD CONSTRAINT pk_points_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: point_transactions point_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: posts posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: progress_photos progress_photos_uploader_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progress_photos
    ADD CONSTRAINT progress_photos_uploader_id_fkey FOREIGN KEY (uploader_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: quiz_answers quiz_answers_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_answers
    ADD CONSTRAINT quiz_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.quiz_questions(id) ON DELETE CASCADE;


--
-- Name: quiz_answers quiz_answers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_answers
    ADD CONSTRAINT quiz_answers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: quiz_questions quiz_questions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_questions
    ADD CONSTRAINT quiz_questions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: reactions reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: reward_redemptions reward_redemptions_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_redemptions
    ADD CONSTRAINT reward_redemptions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: reward_redemptions reward_redemptions_reward_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_redemptions
    ADD CONSTRAINT reward_redemptions_reward_id_fkey FOREIGN KEY (reward_id) REFERENCES public.rewards(id) ON DELETE SET NULL;


--
-- Name: reward_redemptions reward_redemptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_redemptions
    ADD CONSTRAINT reward_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: voice_sessions voice_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_sessions
    ADD CONSTRAINT voice_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: wordle_attempts wordle_attempts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wordle_attempts
    ADD CONSTRAINT wordle_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: wordle_results wordle_results_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wordle_results
    ADD CONSTRAINT wordle_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: accessory_catalog Accessory catalog is public to all logged-in users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Accessory catalog is public to all logged-in users" ON public.accessory_catalog FOR SELECT TO authenticated USING (true);


--
-- Name: comments Admins can delete any comment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete any comment" ON public.comments FOR DELETE TO authenticated USING (public.viewer_is_admin());


--
-- Name: direct_messages Admins can delete any direct message; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete any direct message" ON public.direct_messages FOR DELETE TO authenticated USING (public.viewer_is_admin());


--
-- Name: goals Admins can delete any goal; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete any goal" ON public.goals FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND profiles.is_admin))));


--
-- Name: posts Admins can delete any post; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete any post" ON public.posts FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND profiles.is_admin))));


--
-- Name: bet_options Bet options are public to all logged-in users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Bet options are public to all logged-in users" ON public.bet_options FOR SELECT TO authenticated USING (true);


--
-- Name: bet_wagers Bet wagers are public to all logged-in users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Bet wagers are public to all logged-in users" ON public.bet_wagers FOR SELECT TO authenticated USING (true);


--
-- Name: bets Bets are public to all logged-in users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Bets are public to all logged-in users" ON public.bets FOR SELECT TO authenticated USING (true);


--
-- Name: border_catalog Border catalog is public to all logged-in users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Border catalog is public to all logged-in users" ON public.border_catalog FOR SELECT TO authenticated USING (true);


--
-- Name: hof_categories Categories are public to all logged-in users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Categories are public to all logged-in users" ON public.hof_categories FOR SELECT TO authenticated USING (true);


--
-- Name: challenges Challenges are public to all logged-in users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Challenges are public to all logged-in users" ON public.challenges FOR SELECT TO authenticated USING (true);


--
-- Name: comments Comments are public to all logged-in users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Comments are public to all logged-in users" ON public.comments FOR SELECT TO authenticated USING (true);


--
-- Name: goals Goals are public to all logged-in users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Goals are public to all logged-in users" ON public.goals FOR SELECT TO authenticated USING (true);


--
-- Name: mentorships Mentor managers can create pairings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Mentor managers can create pairings" ON public.mentorships FOR INSERT TO authenticated WITH CHECK (public.has_permission('manage_mentors'::text));


--
-- Name: mentorships Mentor managers can delete pairings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Mentor managers can delete pairings" ON public.mentorships FOR DELETE TO authenticated USING (public.has_permission('manage_mentors'::text));


--
-- Name: mentorships Mentor managers can update pairings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Mentor managers can update pairings" ON public.mentorships FOR UPDATE TO authenticated USING (public.has_permission('manage_mentors'::text));


--
-- Name: mentorships Mentorships are public to all logged-in users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Mentorships are public to all logged-in users" ON public.mentorships FOR SELECT TO authenticated USING (true);


--
-- Name: progress_photos Owners/participants can add progress photos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners/participants can add progress photos" ON public.progress_photos FOR INSERT TO authenticated WITH CHECK (((uploader_id = auth.uid()) AND (((target_type = 'goal'::text) AND (EXISTS ( SELECT 1
   FROM public.goals g
  WHERE ((g.id = progress_photos.target_id) AND (g.owner_id = auth.uid()))))) OR ((target_type = 'challenge'::text) AND (EXISTS ( SELECT 1
   FROM public.challenges c
  WHERE ((c.id = progress_photos.target_id) AND ((c.creator_id = auth.uid()) OR (c.opponent_id = auth.uid())))))))));


--
-- Name: direct_messages Participants can view messages in their conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can view messages in their conversations" ON public.direct_messages FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.dm_conversations c
  WHERE ((c.id = direct_messages.conversation_id) AND ((auth.uid() = c.user_a) OR (auth.uid() = c.user_b))))));


--
-- Name: dm_conversations Participants can view their conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can view their conversations" ON public.dm_conversations FOR SELECT TO authenticated USING (((auth.uid() = user_a) OR (auth.uid() = user_b)));


--
-- Name: hof_categories Permitted users can create categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitted users can create categories" ON public.hof_categories FOR INSERT TO authenticated WITH CHECK (public.has_permission('manage_hall_of_fame'::text));


--
-- Name: hof_records Permitted users can retire records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitted users can retire records" ON public.hof_records FOR UPDATE TO authenticated USING (public.has_permission('manage_hall_of_fame'::text)) WITH CHECK ((is_current = false));


--
-- Name: hof_records Permitted users can submit records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitted users can submit records" ON public.hof_records FOR INSERT TO authenticated WITH CHECK (public.has_permission('manage_hall_of_fame'::text));


--
-- Name: posts Posts are public to all logged-in users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Posts are public to all logged-in users" ON public.posts FOR SELECT TO authenticated USING (true);


--
-- Name: profiles Profiles are visible unless deactivated or hidden; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles are visible unless deactivated or hidden" ON public.profiles FOR SELECT TO authenticated USING ((((NOT is_deleted) AND (NOT is_hidden)) OR (id = auth.uid())));


--
-- Name: progress_photos Progress photos are viewable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Progress photos are viewable by authenticated users" ON public.progress_photos FOR SELECT TO authenticated USING (true);


--
-- Name: quiz_questions Quiz managers can add questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Quiz managers can add questions" ON public.quiz_questions FOR INSERT TO authenticated WITH CHECK (public.has_permission('manage_quiz'::text));


--
-- Name: quiz_questions Quiz managers can delete questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Quiz managers can delete questions" ON public.quiz_questions FOR DELETE TO authenticated USING (public.has_permission('manage_quiz'::text));


--
-- Name: quiz_questions Quiz managers can view questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Quiz managers can view questions" ON public.quiz_questions FOR SELECT TO authenticated USING (public.has_permission('manage_quiz'::text));


--
-- Name: reactions Reactions are public to all logged-in users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Reactions are public to all logged-in users" ON public.reactions FOR SELECT TO authenticated USING (true);


--
-- Name: hof_records Records are public to all logged-in users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Records are public to all logged-in users" ON public.hof_records FOR SELECT TO authenticated USING (true);


--
-- Name: direct_messages Senders can delete their own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Senders can delete their own messages" ON public.direct_messages FOR DELETE TO authenticated USING ((sender_id = auth.uid()));


--
-- Name: progress_photos Uploader or admin can delete progress photos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Uploader or admin can delete progress photos" ON public.progress_photos FOR DELETE TO authenticated USING (((uploader_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND p.is_admin)))));


--
-- Name: comments Users can add comments as themselves; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can add comments as themselves" ON public.comments FOR INSERT TO authenticated WITH CHECK ((author_id = auth.uid()));


--
-- Name: goals Users can create their own goals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own goals" ON public.goals FOR INSERT TO authenticated WITH CHECK ((owner_id = auth.uid()));


--
-- Name: posts Users can create their own posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own posts" ON public.posts FOR INSERT TO authenticated WITH CHECK ((author_id = auth.uid()));


--
-- Name: comments Users can delete their own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own comments" ON public.comments FOR DELETE TO authenticated USING ((author_id = auth.uid()));


--
-- Name: goals Users can delete their own goals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own goals" ON public.goals FOR DELETE TO authenticated USING ((owner_id = auth.uid()));


--
-- Name: posts Users can delete their own posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own posts" ON public.posts FOR DELETE TO authenticated USING ((author_id = auth.uid()));


--
-- Name: notifications Users can mark their own notifications read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can mark their own notifications read" ON public.notifications FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: reactions Users can react as themselves; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can react as themselves" ON public.reactions FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: reactions Users can remove their own reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can remove their own reactions" ON public.reactions FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: goals Users can update their own goals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own goals" ON public.goals FOR UPDATE TO authenticated USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: notifications Users can view their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: point_transactions Users can view their own point history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own point history" ON public.point_transactions FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: quiz_answers Users can view their own quiz answers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own quiz answers" ON public.quiz_answers FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: wordle_attempts Users can view their own wordle attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own wordle attempts" ON public.wordle_attempts FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: wordle_results Wordle results are public to all logged-in users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Wordle results are public to all logged-in users" ON public.wordle_results FOR SELECT TO authenticated USING (true);


--
-- Name: accessory_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.accessory_catalog ENABLE ROW LEVEL SECURITY;

--
-- Name: achievements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

--
-- Name: achievements achievements_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY achievements_admin ON public.achievements TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND profiles.is_admin)))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND profiles.is_admin))));


--
-- Name: achievements achievements_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY achievements_read ON public.achievements FOR SELECT USING (true);


--
-- Name: bet_options; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bet_options ENABLE ROW LEVEL SECURITY;

--
-- Name: bet_wagers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bet_wagers ENABLE ROW LEVEL SECURITY;

--
-- Name: bets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;

--
-- Name: birthday_email_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.birthday_email_log ENABLE ROW LEVEL SECURITY;

--
-- Name: birthday_email_log birthday_email_log_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY birthday_email_log_admin_select ON public.birthday_email_log FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));


--
-- Name: birthday_email_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.birthday_email_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: birthday_email_settings birthday_email_settings_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY birthday_email_settings_admin_select ON public.birthday_email_settings FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));


--
-- Name: birthday_email_settings birthday_email_settings_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY birthday_email_settings_admin_update ON public.birthday_email_settings FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true))))) WITH CHECK (((id = 1) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true))))));


--
-- Name: birthday_notification_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.birthday_notification_log ENABLE ROW LEVEL SECURITY;

--
-- Name: border_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.border_catalog ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.challenge_events ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_events challenge_events_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY challenge_events_read ON public.challenge_events FOR SELECT TO authenticated USING (true);


--
-- Name: challenge_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_participants challenge_participants_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY challenge_participants_read ON public.challenge_participants FOR SELECT TO authenticated USING (true);


--
-- Name: challenge_score_updates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.challenge_score_updates ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_score_updates challenge_score_updates_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY challenge_score_updates_read ON public.challenge_score_updates FOR SELECT TO authenticated USING (true);


--
-- Name: challenge_terms_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.challenge_terms_history ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_terms_history challenge_terms_history_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY challenge_terms_history_read ON public.challenge_terms_history FOR SELECT TO authenticated USING (true);


--
-- Name: challenges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

--
-- Name: direct_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: dm_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dm_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: goal_updates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.goal_updates ENABLE ROW LEVEL SECURITY;

--
-- Name: goal_updates goal_updates_delete_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY goal_updates_delete_own_or_admin ON public.goal_updates FOR DELETE TO authenticated USING (((author_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true))))));


--
-- Name: goal_updates goal_updates_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY goal_updates_insert_own ON public.goal_updates FOR INSERT TO authenticated WITH CHECK (((author_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.goals
  WHERE ((goals.id = goal_updates.goal_id) AND (goals.owner_id = auth.uid()))))));


--
-- Name: goal_updates goal_updates_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY goal_updates_select_authenticated ON public.goal_updates FOR SELECT TO authenticated USING (true);


--
-- Name: goals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

--
-- Name: hof_award_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hof_award_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: hof_award_winners; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hof_award_winners ENABLE ROW LEVEL SECURITY;

--
-- Name: hof_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hof_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: hof_award_categories hof_categories_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hof_categories_manage ON public.hof_award_categories TO authenticated USING (public.hof_can_manage('manage_hof_awards'::text)) WITH CHECK (public.hof_can_manage('manage_hof_awards'::text));


--
-- Name: hof_award_categories hof_categories_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hof_categories_read ON public.hof_award_categories FOR SELECT TO authenticated USING (true);


--
-- Name: hof_deletion_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hof_deletion_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: hof_deletion_logs hof_logs_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hof_logs_read ON public.hof_deletion_logs FOR SELECT TO authenticated USING ((public.hof_can_manage('manage_hof_awards'::text) OR public.hof_can_manage('manage_hall_of_fame'::text)));


--
-- Name: hof_podium_exclusions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hof_podium_exclusions ENABLE ROW LEVEL SECURITY;

--
-- Name: hof_podium_exclusions hof_podium_exclusions_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hof_podium_exclusions_select_authenticated ON public.hof_podium_exclusions FOR SELECT TO authenticated USING (true);


--
-- Name: hof_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hof_records ENABLE ROW LEVEL SECURITY;

--
-- Name: hof_records hof_records_delete_managers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hof_records_delete_managers ON public.hof_records FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.is_admin = true) OR ('manage_hall_of_fame'::text = ANY (profiles.permissions)))))));


--
-- Name: hof_award_winners hof_winners_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hof_winners_read ON public.hof_award_winners FOR SELECT TO authenticated USING (true);


--
-- Name: login_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.login_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: login_sessions login_sessions_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY login_sessions_select_authenticated ON public.login_sessions FOR SELECT TO authenticated USING (true);


--
-- Name: mentorships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mentorships ENABLE ROW LEVEL SECURITY;

--
-- Name: mission_activity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mission_activity ENABLE ROW LEVEL SECURITY;

--
-- Name: mission_claims; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mission_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mission_claims mission_claims_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mission_claims_read ON public.mission_claims FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_points_admin()));


--
-- Name: missions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

--
-- Name: missions missions_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY missions_admin ON public.missions TO authenticated USING (public.is_points_admin()) WITH CHECK (public.is_points_admin());


--
-- Name: missions missions_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY missions_read ON public.missions FOR SELECT TO authenticated USING (true);


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: org_departments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_departments ENABLE ROW LEVEL SECURITY;

--
-- Name: org_departments org_departments_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_departments_read ON public.org_departments FOR SELECT USING (true);


--
-- Name: org_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: org_roles org_roles_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_roles_read ON public.org_roles FOR SELECT USING (true);


--
-- Name: pk_money_debts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pk_money_debts ENABLE ROW LEVEL SECURITY;

--
-- Name: pk_money_debts pk_money_debts_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pk_money_debts_read ON public.pk_money_debts FOR SELECT TO authenticated USING ((((auth.uid() = debtor_id) OR (auth.uid() = creditor_id)) OR public.viewer_is_admin()));


--
-- Name: pk_playbooks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pk_playbooks ENABLE ROW LEVEL SECURITY;

--
-- Name: pk_playbooks pk_playbooks_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pk_playbooks_read ON public.pk_playbooks FOR SELECT TO authenticated USING (true);


--
-- Name: pk_points; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pk_points ENABLE ROW LEVEL SECURITY;

--
-- Name: pk_points pk_points_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pk_points_read ON public.pk_points FOR SELECT TO authenticated USING (true);


--
-- Name: pk_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pk_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: pk_settings pk_settings_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pk_settings_read ON public.pk_settings FOR SELECT TO authenticated USING (true);


--
-- Name: point_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: points_maintenance_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.points_maintenance_log ENABLE ROW LEVEL SECURITY;

--
-- Name: points_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.points_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: points_settings points_settings_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY points_settings_admin ON public.points_settings FOR UPDATE TO authenticated USING (public.is_points_admin()) WITH CHECK (public.is_points_admin());


--
-- Name: points_settings points_settings_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY points_settings_read ON public.points_settings FOR SELECT TO authenticated USING (true);


--
-- Name: posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: progress_photos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions push_subscriptions_own_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY push_subscriptions_own_delete ON public.push_subscriptions FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: push_subscriptions push_subscriptions_own_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY push_subscriptions_own_select ON public.push_subscriptions FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: quiz_answers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;

--
-- Name: quiz_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: reward_redemptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

--
-- Name: reward_redemptions reward_redemptions_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reward_redemptions_read ON public.reward_redemptions FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_points_admin()));


--
-- Name: rewards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

--
-- Name: rewards rewards_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rewards_admin ON public.rewards TO authenticated USING (public.is_points_admin()) WITH CHECK (public.is_points_admin());


--
-- Name: rewards rewards_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rewards_read ON public.rewards FOR SELECT TO authenticated USING (true);


--
-- Name: voice_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.voice_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: voice_sessions voice_sessions_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY voice_sessions_select_authenticated ON public.voice_sessions FOR SELECT TO authenticated USING (true);


--
-- Name: wordle_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wordle_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: wordle_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wordle_results ENABLE ROW LEVEL SECURITY;

--
-- Name: wordle_valid_guesses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wordle_valid_guesses ENABLE ROW LEVEL SECURITY;

--
-- Name: wordle_words; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wordle_words ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION admin_adjust_points(target_user uuid, amount integer, reason text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.admin_adjust_points(target_user uuid, amount integer, reason text) TO anon;
GRANT ALL ON FUNCTION public.admin_adjust_points(target_user uuid, amount integer, reason text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_adjust_points(target_user uuid, amount integer, reason text) TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: FUNCTION admin_list_profiles(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.admin_list_profiles() TO anon;
GRANT ALL ON FUNCTION public.admin_list_profiles() TO authenticated;
GRANT ALL ON FUNCTION public.admin_list_profiles() TO service_role;


--
-- Name: FUNCTION admin_org_delete(kind text, item_name text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.admin_org_delete(kind text, item_name text) TO anon;
GRANT ALL ON FUNCTION public.admin_org_delete(kind text, item_name text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_org_delete(kind text, item_name text) TO service_role;


--
-- Name: FUNCTION admin_org_move(kind text, item_name text, direction integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.admin_org_move(kind text, item_name text, direction integer) TO anon;
GRANT ALL ON FUNCTION public.admin_org_move(kind text, item_name text, direction integer) TO authenticated;
GRANT ALL ON FUNCTION public.admin_org_move(kind text, item_name text, direction integer) TO service_role;


--
-- Name: FUNCTION admin_org_save(kind text, old_name text, new_name text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.admin_org_save(kind text, old_name text, new_name text) TO anon;
GRANT ALL ON FUNCTION public.admin_org_save(kind text, old_name text, new_name text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_org_save(kind text, old_name text, new_name text) TO service_role;


--
-- Name: FUNCTION admin_review_mission_claim(claim_id_param uuid, approve boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.admin_review_mission_claim(claim_id_param uuid, approve boolean) TO anon;
GRANT ALL ON FUNCTION public.admin_review_mission_claim(claim_id_param uuid, approve boolean) TO authenticated;
GRANT ALL ON FUNCTION public.admin_review_mission_claim(claim_id_param uuid, approve boolean) TO service_role;


--
-- Name: FUNCTION admin_review_redemption(redemption_id_param uuid, approve boolean, note text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.admin_review_redemption(redemption_id_param uuid, approve boolean, note text) TO anon;
GRANT ALL ON FUNCTION public.admin_review_redemption(redemption_id_param uuid, approve boolean, note text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_review_redemption(redemption_id_param uuid, approve boolean, note text) TO service_role;


--
-- Name: FUNCTION admin_set_achievement(target_user uuid, achievement_key text, has_it boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.admin_set_achievement(target_user uuid, achievement_key text, has_it boolean) TO anon;
GRANT ALL ON FUNCTION public.admin_set_achievement(target_user uuid, achievement_key text, has_it boolean) TO authenticated;
GRANT ALL ON FUNCTION public.admin_set_achievement(target_user uuid, achievement_key text, has_it boolean) TO service_role;


--
-- Name: FUNCTION admin_set_birthday(user_id_param uuid, birthday_param date); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.admin_set_birthday(user_id_param uuid, birthday_param date) TO anon;
GRANT ALL ON FUNCTION public.admin_set_birthday(user_id_param uuid, birthday_param date) TO authenticated;
GRANT ALL ON FUNCTION public.admin_set_birthday(user_id_param uuid, birthday_param date) TO service_role;


--
-- Name: FUNCTION admin_set_role_department(user_id_param uuid, role_param text, department_param text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.admin_set_role_department(user_id_param uuid, role_param text, department_param text) TO anon;
GRANT ALL ON FUNCTION public.admin_set_role_department(user_id_param uuid, role_param text, department_param text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_set_role_department(user_id_param uuid, role_param text, department_param text) TO service_role;


--
-- Name: FUNCTION admin_set_username(target_user uuid, new_username text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.admin_set_username(target_user uuid, new_username text) TO anon;
GRANT ALL ON FUNCTION public.admin_set_username(target_user uuid, new_username text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_set_username(target_user uuid, new_username text) TO service_role;


--
-- Name: FUNCTION apply_point_transaction(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.apply_point_transaction() TO anon;
GRANT ALL ON FUNCTION public.apply_point_transaction() TO authenticated;
GRANT ALL ON FUNCTION public.apply_point_transaction() TO service_role;


--
-- Name: FUNCTION award_goal_completion_points(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.award_goal_completion_points() TO anon;
GRANT ALL ON FUNCTION public.award_goal_completion_points() TO authenticated;
GRANT ALL ON FUNCTION public.award_goal_completion_points() TO service_role;


--
-- Name: FUNCTION award_hof_record_points(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.award_hof_record_points() TO anon;
GRANT ALL ON FUNCTION public.award_hof_record_points() TO authenticated;
GRANT ALL ON FUNCTION public.award_hof_record_points() TO service_role;


--
-- Name: FUNCTION award_title(target_user uuid, title_key text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.award_title(target_user uuid, title_key text) TO anon;
GRANT ALL ON FUNCTION public.award_title(target_user uuid, title_key text) TO authenticated;
GRANT ALL ON FUNCTION public.award_title(target_user uuid, title_key text) TO service_role;


--
-- Name: FUNCTION birthday_email_settings_stamp(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.birthday_email_settings_stamp() TO anon;
GRANT ALL ON FUNCTION public.birthday_email_settings_stamp() TO authenticated;
GRANT ALL ON FUNCTION public.birthday_email_settings_stamp() TO service_role;


--
-- Name: FUNCTION cancel_bet(bet_id_param uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cancel_bet(bet_id_param uuid) TO anon;
GRANT ALL ON FUNCTION public.cancel_bet(bet_id_param uuid) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_bet(bet_id_param uuid) TO service_role;


--
-- Name: FUNCTION cancel_challenge(challenge_id_param uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cancel_challenge(challenge_id_param uuid) TO anon;
GRANT ALL ON FUNCTION public.cancel_challenge(challenge_id_param uuid) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_challenge(challenge_id_param uuid) TO service_role;


--
-- Name: FUNCTION claim_daily_login_bonus(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.claim_daily_login_bonus() TO anon;
GRANT ALL ON FUNCTION public.claim_daily_login_bonus() TO authenticated;
GRANT ALL ON FUNCTION public.claim_daily_login_bonus() TO service_role;


--
-- Name: FUNCTION claim_mission(mission_id_param uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.claim_mission(mission_id_param uuid) TO anon;
GRANT ALL ON FUNCTION public.claim_mission(mission_id_param uuid) TO authenticated;
GRANT ALL ON FUNCTION public.claim_mission(mission_id_param uuid) TO service_role;


--
-- Name: FUNCTION complete_challenge(challenge_id_param uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.complete_challenge(challenge_id_param uuid) TO anon;
GRANT ALL ON FUNCTION public.complete_challenge(challenge_id_param uuid) TO authenticated;
GRANT ALL ON FUNCTION public.complete_challenge(challenge_id_param uuid) TO service_role;


--
-- Name: FUNCTION create_bet(title_param text, options_param text[], closes_at_param timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_bet(title_param text, options_param text[], closes_at_param timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.create_bet(title_param text, options_param text[], closes_at_param timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.create_bet(title_param text, options_param text[], closes_at_param timestamp with time zone) TO service_role;


--
-- Name: FUNCTION create_challenge(opponent_id_param uuid, topic_param text, description_param text, reward_param text, punishment_param text, ends_at_param timestamp with time zone, metric_param text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_challenge(opponent_id_param uuid, topic_param text, description_param text, reward_param text, punishment_param text, ends_at_param timestamp with time zone, metric_param text) TO anon;
GRANT ALL ON FUNCTION public.create_challenge(opponent_id_param uuid, topic_param text, description_param text, reward_param text, punishment_param text, ends_at_param timestamp with time zone, metric_param text) TO authenticated;
GRANT ALL ON FUNCTION public.create_challenge(opponent_id_param uuid, topic_param text, description_param text, reward_param text, punishment_param text, ends_at_param timestamp with time zone, metric_param text) TO service_role;


--
-- Name: FUNCTION deactivate_user(target_user uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.deactivate_user(target_user uuid) TO anon;
GRANT ALL ON FUNCTION public.deactivate_user(target_user uuid) TO authenticated;
GRANT ALL ON FUNCTION public.deactivate_user(target_user uuid) TO service_role;


--
-- Name: FUNCTION delete_challenge(challenge_id_param uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_challenge(challenge_id_param uuid) TO anon;
GRANT ALL ON FUNCTION public.delete_challenge(challenge_id_param uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_challenge(challenge_id_param uuid) TO service_role;


--
-- Name: FUNCTION delete_own_account(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_own_account() TO anon;
GRANT ALL ON FUNCTION public.delete_own_account() TO authenticated;
GRANT ALL ON FUNCTION public.delete_own_account() TO service_role;


--
-- Name: FUNCTION end_my_session(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.end_my_session() TO anon;
GRANT ALL ON FUNCTION public.end_my_session() TO authenticated;
GRANT ALL ON FUNCTION public.end_my_session() TO service_role;


--
-- Name: FUNCTION get_my_missions(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_my_missions() TO anon;
GRANT ALL ON FUNCTION public.get_my_missions() TO authenticated;
GRANT ALL ON FUNCTION public.get_my_missions() TO service_role;


--
-- Name: FUNCTION get_or_create_dm_conversation(other_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_or_create_dm_conversation(other_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_or_create_dm_conversation(other_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_or_create_dm_conversation(other_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_quiz_leaderboard(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_quiz_leaderboard() TO anon;
GRANT ALL ON FUNCTION public.get_quiz_leaderboard() TO authenticated;
GRANT ALL ON FUNCTION public.get_quiz_leaderboard() TO service_role;


--
-- Name: FUNCTION get_quiz_questions(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_quiz_questions() TO anon;
GRANT ALL ON FUNCTION public.get_quiz_questions() TO authenticated;
GRANT ALL ON FUNCTION public.get_quiz_questions() TO service_role;


--
-- Name: FUNCTION get_target_owner(target_type_param text, target_id_param text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_target_owner(target_type_param text, target_id_param text) TO anon;
GRANT ALL ON FUNCTION public.get_target_owner(target_type_param text, target_id_param text) TO authenticated;
GRANT ALL ON FUNCTION public.get_target_owner(target_type_param text, target_id_param text) TO service_role;


--
-- Name: FUNCTION gift_points(recipient_id uuid, amount integer, note text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.gift_points(recipient_id uuid, amount integer, note text) TO anon;
GRANT ALL ON FUNCTION public.gift_points(recipient_id uuid, amount integer, note text) TO authenticated;
GRANT ALL ON FUNCTION public.gift_points(recipient_id uuid, amount integer, note text) TO service_role;


--
-- Name: FUNCTION guard_point_transaction(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.guard_point_transaction() TO anon;
GRANT ALL ON FUNCTION public.guard_point_transaction() TO authenticated;
GRANT ALL ON FUNCTION public.guard_point_transaction() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION has_permission(perm text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.has_permission(perm text) TO anon;
GRANT ALL ON FUNCTION public.has_permission(perm text) TO authenticated;
GRANT ALL ON FUNCTION public.has_permission(perm text) TO service_role;


--
-- Name: FUNCTION hof_audit_delete(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.hof_audit_delete() FROM PUBLIC;
GRANT ALL ON FUNCTION public.hof_audit_delete() TO anon;
GRANT ALL ON FUNCTION public.hof_audit_delete() TO authenticated;
GRANT ALL ON FUNCTION public.hof_audit_delete() TO service_role;


--
-- Name: FUNCTION hof_can_manage(permission_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.hof_can_manage(permission_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.hof_can_manage(permission_name text) TO anon;
GRANT ALL ON FUNCTION public.hof_can_manage(permission_name text) TO authenticated;
GRANT ALL ON FUNCTION public.hof_can_manage(permission_name text) TO service_role;


--
-- Name: FUNCTION hof_delete_category(target_category uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.hof_delete_category(target_category uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.hof_delete_category(target_category uuid) TO anon;
GRANT ALL ON FUNCTION public.hof_delete_category(target_category uuid) TO authenticated;
GRANT ALL ON FUNCTION public.hof_delete_category(target_category uuid) TO service_role;


--
-- Name: FUNCTION hof_delete_record(target_record uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.hof_delete_record(target_record uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.hof_delete_record(target_record uuid) TO anon;
GRANT ALL ON FUNCTION public.hof_delete_record(target_record uuid) TO authenticated;
GRANT ALL ON FUNCTION public.hof_delete_record(target_record uuid) TO service_role;


--
-- Name: FUNCTION hof_save_winners(target_category uuid, target_month date, winners jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.hof_save_winners(target_category uuid, target_month date, winners jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.hof_save_winners(target_category uuid, target_month date, winners jsonb) TO anon;
GRANT ALL ON FUNCTION public.hof_save_winners(target_category uuid, target_month date, winners jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.hof_save_winners(target_category uuid, target_month date, winners jsonb) TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_admin() TO anon;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;


--
-- Name: FUNCTION is_points_admin(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_points_admin() TO anon;
GRANT ALL ON FUNCTION public.is_points_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_points_admin() TO service_role;


--
-- Name: FUNCTION join_voice_session(p_channel_id text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.join_voice_session(p_channel_id text) TO anon;
GRANT ALL ON FUNCTION public.join_voice_session(p_channel_id text) TO authenticated;
GRANT ALL ON FUNCTION public.join_voice_session(p_channel_id text) TO service_role;


--
-- Name: FUNCTION leave_voice_session(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.leave_voice_session() TO anon;
GRANT ALL ON FUNCTION public.leave_voice_session() TO authenticated;
GRANT ALL ON FUNCTION public.leave_voice_session() TO service_role;


--
-- Name: FUNCTION log_mission_activity(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.log_mission_activity() TO anon;
GRANT ALL ON FUNCTION public.log_mission_activity() TO authenticated;
GRANT ALL ON FUNCTION public.log_mission_activity() TO service_role;


--
-- Name: FUNCTION mark_dm_read(conversation_id_param uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mark_dm_read(conversation_id_param uuid) TO anon;
GRANT ALL ON FUNCTION public.mark_dm_read(conversation_id_param uuid) TO authenticated;
GRANT ALL ON FUNCTION public.mark_dm_read(conversation_id_param uuid) TO service_role;


--
-- Name: FUNCTION mission_progress(uid uuid, kind text, win_start timestamp with time zone, win_end timestamp with time zone, tz text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mission_progress(uid uuid, kind text, win_start timestamp with time zone, win_end timestamp with time zone, tz text) TO anon;
GRANT ALL ON FUNCTION public.mission_progress(uid uuid, kind text, win_start timestamp with time zone, win_end timestamp with time zone, tz text) TO authenticated;
GRANT ALL ON FUNCTION public.mission_progress(uid uuid, kind text, win_start timestamp with time zone, win_end timestamp with time zone, tz text) TO service_role;


--
-- Name: FUNCTION mission_window(cadence text, starts_at timestamp with time zone, ends_at timestamp with time zone, tz text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mission_window(cadence text, starts_at timestamp with time zone, ends_at timestamp with time zone, tz text) TO anon;
GRANT ALL ON FUNCTION public.mission_window(cadence text, starts_at timestamp with time zone, ends_at timestamp with time zone, tz text) TO authenticated;
GRANT ALL ON FUNCTION public.mission_window(cadence text, starts_at timestamp with time zone, ends_at timestamp with time zone, tz text) TO service_role;


--
-- Name: FUNCTION notify_comment_reply(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.notify_comment_reply() TO anon;
GRANT ALL ON FUNCTION public.notify_comment_reply() TO authenticated;
GRANT ALL ON FUNCTION public.notify_comment_reply() TO service_role;


--
-- Name: FUNCTION notify_goal_completed(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.notify_goal_completed() TO anon;
GRANT ALL ON FUNCTION public.notify_goal_completed() TO authenticated;
GRANT ALL ON FUNCTION public.notify_goal_completed() TO service_role;


--
-- Name: FUNCTION notify_on_comment(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.notify_on_comment() TO anon;
GRANT ALL ON FUNCTION public.notify_on_comment() TO authenticated;
GRANT ALL ON FUNCTION public.notify_on_comment() TO service_role;


--
-- Name: FUNCTION notify_on_reaction(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.notify_on_reaction() TO anon;
GRANT ALL ON FUNCTION public.notify_on_reaction() TO authenticated;
GRANT ALL ON FUNCTION public.notify_on_reaction() TO service_role;


--
-- Name: FUNCTION notify_profile_rewards(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.notify_profile_rewards() TO anon;
GRANT ALL ON FUNCTION public.notify_profile_rewards() TO authenticated;
GRANT ALL ON FUNCTION public.notify_profile_rewards() TO service_role;


--
-- Name: FUNCTION notify_todays_birthdays(tz text, notify_hour integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_todays_birthdays(tz text, notify_hour integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_todays_birthdays(tz text, notify_hour integer) TO service_role;


--
-- Name: FUNCTION pk_accept_open(cid uuid, my_baseline numeric, my_target numeric); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_accept_open(cid uuid, my_baseline numeric, my_target numeric) TO anon;
GRANT ALL ON FUNCTION public.pk_accept_open(cid uuid, my_baseline numeric, my_target numeric) TO authenticated;
GRANT ALL ON FUNCTION public.pk_accept_open(cid uuid, my_baseline numeric, my_target numeric) TO service_role;


--
-- Name: FUNCTION pk_all_accepted(cid uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_all_accepted(cid uuid) TO anon;
GRANT ALL ON FUNCTION public.pk_all_accepted(cid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.pk_all_accepted(cid uuid) TO service_role;


--
-- Name: FUNCTION pk_approver_ids(cid uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_approver_ids(cid uuid) TO anon;
GRANT ALL ON FUNCTION public.pk_approver_ids(cid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.pk_approver_ids(cid uuid) TO service_role;


--
-- Name: FUNCTION pk_auto_settle(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pk_auto_settle() FROM PUBLIC;
GRANT ALL ON FUNCTION public.pk_auto_settle() TO service_role;


--
-- Name: FUNCTION pk_can_approve(cid uuid, user_id_param uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_can_approve(cid uuid, user_id_param uuid) TO anon;
GRANT ALL ON FUNCTION public.pk_can_approve(cid uuid, user_id_param uuid) TO authenticated;
GRANT ALL ON FUNCTION public.pk_can_approve(cid uuid, user_id_param uuid) TO service_role;


--
-- Name: FUNCTION pk_cancel(cid uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_cancel(cid uuid) TO anon;
GRANT ALL ON FUNCTION public.pk_cancel(cid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.pk_cancel(cid uuid) TO service_role;


--
-- Name: FUNCTION pk_champions(dept text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_champions(dept text) TO anon;
GRANT ALL ON FUNCTION public.pk_champions(dept text) TO authenticated;
GRANT ALL ON FUNCTION public.pk_champions(dept text) TO service_role;


--
-- Name: FUNCTION pk_check_participant(cid uuid, user_id_param uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pk_check_participant(cid uuid, user_id_param uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pk_check_participant(cid uuid, user_id_param uuid) TO service_role;


--
-- Name: FUNCTION pk_check_terms(cid uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pk_check_terms(cid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pk_check_terms(cid uuid) TO service_role;


--
-- Name: FUNCTION pk_create(terms jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_create(terms jsonb) TO anon;
GRANT ALL ON FUNCTION public.pk_create(terms jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.pk_create(terms jsonb) TO service_role;


--
-- Name: FUNCTION pk_delete(cid uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_delete(cid uuid) TO anon;
GRANT ALL ON FUNCTION public.pk_delete(cid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.pk_delete(cid uuid) TO service_role;


--
-- Name: FUNCTION pk_expire_open(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pk_expire_open() FROM PUBLIC;
GRANT ALL ON FUNCTION public.pk_expire_open() TO service_role;


--
-- Name: FUNCTION pk_guard_legacy(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_guard_legacy() TO anon;
GRANT ALL ON FUNCTION public.pk_guard_legacy() TO authenticated;
GRANT ALL ON FUNCTION public.pk_guard_legacy() TO service_role;


--
-- Name: FUNCTION pk_leaderboard(period date, dept text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_leaderboard(period date, dept text) TO anon;
GRANT ALL ON FUNCTION public.pk_leaderboard(period date, dept text) TO authenticated;
GRANT ALL ON FUNCTION public.pk_leaderboard(period date, dept text) TO service_role;


--
-- Name: FUNCTION pk_log(cid uuid, kind_name text, message_text text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pk_log(cid uuid, kind_name text, message_text text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pk_log(cid uuid, kind_name text, message_text text) TO service_role;


--
-- Name: FUNCTION pk_mark_paid(debt_id uuid, paid boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_mark_paid(debt_id uuid, paid boolean) TO anon;
GRANT ALL ON FUNCTION public.pk_mark_paid(debt_id uuid, paid boolean) TO authenticated;
GRANT ALL ON FUNCTION public.pk_mark_paid(debt_id uuid, paid boolean) TO service_role;


--
-- Name: FUNCTION pk_me(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_me() TO anon;
GRANT ALL ON FUNCTION public.pk_me() TO authenticated;
GRANT ALL ON FUNCTION public.pk_me() TO service_role;


--
-- Name: FUNCTION pk_money_limit(user_id_param uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_money_limit(user_id_param uuid) TO anon;
GRANT ALL ON FUNCTION public.pk_money_limit(user_id_param uuid) TO authenticated;
GRANT ALL ON FUNCTION public.pk_money_limit(user_id_param uuid) TO service_role;


--
-- Name: FUNCTION pk_money_summary(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_money_summary() TO anon;
GRANT ALL ON FUNCTION public.pk_money_summary() TO authenticated;
GRANT ALL ON FUNCTION public.pk_money_summary() TO service_role;


--
-- Name: FUNCTION pk_money_used(user_id_param uuid, month_start date, exclude_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_money_used(user_id_param uuid, month_start date, exclude_id uuid) TO anon;
GRANT ALL ON FUNCTION public.pk_money_used(user_id_param uuid, month_start date, exclude_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.pk_money_used(user_id_param uuid, month_start date, exclude_id uuid) TO service_role;


--
-- Name: FUNCTION pk_notify(cid uuid, user_ids uuid[], message_text text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pk_notify(cid uuid, user_ids uuid[], message_text text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pk_notify(cid uuid, user_ids uuid[], message_text text) TO service_role;


--
-- Name: FUNCTION pk_pending_approvals(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_pending_approvals() TO anon;
GRANT ALL ON FUNCTION public.pk_pending_approvals() TO authenticated;
GRANT ALL ON FUNCTION public.pk_pending_approvals() TO service_role;


--
-- Name: FUNCTION pk_quarter(ts timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_quarter(ts timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.pk_quarter(ts timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.pk_quarter(ts timestamp with time zone) TO service_role;


--
-- Name: FUNCTION pk_rank_of(user_id_param uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_rank_of(user_id_param uuid) TO anon;
GRANT ALL ON FUNCTION public.pk_rank_of(user_id_param uuid) TO authenticated;
GRANT ALL ON FUNCTION public.pk_rank_of(user_id_param uuid) TO service_role;


--
-- Name: FUNCTION pk_record_debts(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_record_debts() TO anon;
GRANT ALL ON FUNCTION public.pk_record_debts() TO authenticated;
GRANT ALL ON FUNCTION public.pk_record_debts() TO service_role;


--
-- Name: FUNCTION pk_record_terms(cid uuid, action_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pk_record_terms(cid uuid, action_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pk_record_terms(cid uuid, action_name text) TO service_role;


--
-- Name: FUNCTION pk_request_settlement(cid uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_request_settlement(cid uuid) TO anon;
GRANT ALL ON FUNCTION public.pk_request_settlement(cid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.pk_request_settlement(cid uuid) TO service_role;


--
-- Name: FUNCTION pk_respond(cid uuid, response text, counter jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_respond(cid uuid, response text, counter jsonb) TO anon;
GRANT ALL ON FUNCTION public.pk_respond(cid uuid, response text, counter jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.pk_respond(cid uuid, response text, counter jsonb) TO service_role;


--
-- Name: FUNCTION pk_review(cid uuid, approve boolean, note text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_review(cid uuid, approve boolean, note text) TO anon;
GRANT ALL ON FUNCTION public.pk_review(cid uuid, approve boolean, note text) TO authenticated;
GRANT ALL ON FUNCTION public.pk_review(cid uuid, approve boolean, note text) TO service_role;


--
-- Name: FUNCTION pk_role_rank(role_name text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_role_rank(role_name text) TO anon;
GRANT ALL ON FUNCTION public.pk_role_rank(role_name text) TO authenticated;
GRANT ALL ON FUNCTION public.pk_role_rank(role_name text) TO service_role;


--
-- Name: FUNCTION pk_settle_start(cid uuid, early boolean, forced_side text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pk_settle_start(cid uuid, early boolean, forced_side text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pk_settle_start(cid uuid, early boolean, forced_side text) TO service_role;


--
-- Name: FUNCTION pk_side_scores(cid uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_side_scores(cid uuid) TO anon;
GRANT ALL ON FUNCTION public.pk_side_scores(cid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.pk_side_scores(cid uuid) TO service_role;


--
-- Name: FUNCTION pk_submit_playbook(cid uuid, extra text, worked text, copy text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_submit_playbook(cid uuid, extra text, worked text, copy text) TO anon;
GRANT ALL ON FUNCTION public.pk_submit_playbook(cid uuid, extra text, worked text, copy text) TO authenticated;
GRANT ALL ON FUNCTION public.pk_submit_playbook(cid uuid, extra text, worked text, copy text) TO service_role;


--
-- Name: FUNCTION pk_target_reached(cid uuid, side_param text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_target_reached(cid uuid, side_param text) TO anon;
GRANT ALL ON FUNCTION public.pk_target_reached(cid uuid, side_param text) TO authenticated;
GRANT ALL ON FUNCTION public.pk_target_reached(cid uuid, side_param text) TO service_role;


--
-- Name: FUNCTION pk_terminate(cid uuid, reason text, note text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_terminate(cid uuid, reason text, note text) TO anon;
GRANT ALL ON FUNCTION public.pk_terminate(cid uuid, reason text, note text) TO authenticated;
GRANT ALL ON FUNCTION public.pk_terminate(cid uuid, reason text, note text) TO service_role;


--
-- Name: FUNCTION pk_terms_snapshot(cid uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_terms_snapshot(cid uuid) TO anon;
GRANT ALL ON FUNCTION public.pk_terms_snapshot(cid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.pk_terms_snapshot(cid uuid) TO service_role;


--
-- Name: FUNCTION pk_update_score(cid uuid, new_value numeric, proof text, note text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_update_score(cid uuid, new_value numeric, proof text, note text) TO anon;
GRANT ALL ON FUNCTION public.pk_update_score(cid uuid, new_value numeric, proof text, note text) TO authenticated;
GRANT ALL ON FUNCTION public.pk_update_score(cid uuid, new_value numeric, proof text, note text) TO service_role;


--
-- Name: FUNCTION pk_verify(cid uuid, decision text, note text, tiebreak_side text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_verify(cid uuid, decision text, note text, tiebreak_side text) TO anon;
GRANT ALL ON FUNCTION public.pk_verify(cid uuid, decision text, note text, tiebreak_side text) TO authenticated;
GRANT ALL ON FUNCTION public.pk_verify(cid uuid, decision text, note text, tiebreak_side text) TO service_role;


--
-- Name: FUNCTION pk_winner_side(cid uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pk_winner_side(cid uuid) TO anon;
GRANT ALL ON FUNCTION public.pk_winner_side(cid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.pk_winner_side(cid uuid) TO service_role;


--
-- Name: FUNCTION place_wager(bet_id_param uuid, option_id_param uuid, amount_param integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.place_wager(bet_id_param uuid, option_id_param uuid, amount_param integer) TO anon;
GRANT ALL ON FUNCTION public.place_wager(bet_id_param uuid, option_id_param uuid, amount_param integer) TO authenticated;
GRANT ALL ON FUNCTION public.place_wager(bet_id_param uuid, option_id_param uuid, amount_param integer) TO service_role;


--
-- Name: FUNCTION points_ledger_add(uid uuid, amount integer, reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.points_ledger_add(uid uuid, amount integer, reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.points_ledger_add(uid uuid, amount integer, reason text) TO service_role;


--
-- Name: FUNCTION protect_birthday_field(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.protect_birthday_field() TO anon;
GRANT ALL ON FUNCTION public.protect_birthday_field() TO authenticated;
GRANT ALL ON FUNCTION public.protect_birthday_field() TO service_role;


--
-- Name: FUNCTION protect_role_department_fields(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.protect_role_department_fields() TO anon;
GRANT ALL ON FUNCTION public.protect_role_department_fields() TO authenticated;
GRANT ALL ON FUNCTION public.protect_role_department_fields() TO service_role;


--
-- Name: FUNCTION push_new_notification(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.push_new_notification() TO anon;
GRANT ALL ON FUNCTION public.push_new_notification() TO authenticated;
GRANT ALL ON FUNCTION public.push_new_notification() TO service_role;


--
-- Name: FUNCTION reactivate_user(target_user uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.reactivate_user(target_user uuid) TO anon;
GRANT ALL ON FUNCTION public.reactivate_user(target_user uuid) TO authenticated;
GRANT ALL ON FUNCTION public.reactivate_user(target_user uuid) TO service_role;


--
-- Name: FUNCTION redeem_reward(reward_id_param uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.redeem_reward(reward_id_param uuid) TO anon;
GRANT ALL ON FUNCTION public.redeem_reward(reward_id_param uuid) TO authenticated;
GRANT ALL ON FUNCTION public.redeem_reward(reward_id_param uuid) TO service_role;


--
-- Name: FUNCTION remove_deleted_achievement(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.remove_deleted_achievement() TO anon;
GRANT ALL ON FUNCTION public.remove_deleted_achievement() TO authenticated;
GRANT ALL ON FUNCTION public.remove_deleted_achievement() TO service_role;


--
-- Name: FUNCTION resolve_bet(bet_id_param uuid, winning_option_id_param uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.resolve_bet(bet_id_param uuid, winning_option_id_param uuid) TO anon;
GRANT ALL ON FUNCTION public.resolve_bet(bet_id_param uuid, winning_option_id_param uuid) TO authenticated;
GRANT ALL ON FUNCTION public.resolve_bet(bet_id_param uuid, winning_option_id_param uuid) TO service_role;


--
-- Name: FUNCTION respond_challenge(challenge_id_param uuid, accept boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.respond_challenge(challenge_id_param uuid, accept boolean) TO anon;
GRANT ALL ON FUNCTION public.respond_challenge(challenge_id_param uuid, accept boolean) TO authenticated;
GRANT ALL ON FUNCTION public.respond_challenge(challenge_id_param uuid, accept boolean) TO service_role;


--
-- Name: FUNCTION role_rank(role_param text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.role_rank(role_param text) TO anon;
GRANT ALL ON FUNCTION public.role_rank(role_param text) TO authenticated;
GRANT ALL ON FUNCTION public.role_rank(role_param text) TO service_role;


--
-- Name: FUNCTION save_push_subscription(endpoint_param text, p256dh_param text, auth_param text, user_agent_param text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.save_push_subscription(endpoint_param text, p256dh_param text, auth_param text, user_agent_param text) TO anon;
GRANT ALL ON FUNCTION public.save_push_subscription(endpoint_param text, p256dh_param text, auth_param text, user_agent_param text) TO authenticated;
GRANT ALL ON FUNCTION public.save_push_subscription(endpoint_param text, p256dh_param text, auth_param text, user_agent_param text) TO service_role;


--
-- Name: FUNCTION send_dm(conversation_id_param uuid, body_param text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.send_dm(conversation_id_param uuid, body_param text) TO anon;
GRANT ALL ON FUNCTION public.send_dm(conversation_id_param uuid, body_param text) TO authenticated;
GRANT ALL ON FUNCTION public.send_dm(conversation_id_param uuid, body_param text) TO service_role;


--
-- Name: FUNCTION set_active_accessory(accessory_key text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_active_accessory(accessory_key text) TO anon;
GRANT ALL ON FUNCTION public.set_active_accessory(accessory_key text) TO authenticated;
GRANT ALL ON FUNCTION public.set_active_accessory(accessory_key text) TO service_role;


--
-- Name: FUNCTION set_active_border(border_key text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_active_border(border_key text) TO anon;
GRANT ALL ON FUNCTION public.set_active_border(border_key text) TO authenticated;
GRANT ALL ON FUNCTION public.set_active_border(border_key text) TO service_role;


--
-- Name: FUNCTION set_active_title(title_key text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_active_title(title_key text) TO anon;
GRANT ALL ON FUNCTION public.set_active_title(title_key text) TO authenticated;
GRANT ALL ON FUNCTION public.set_active_title(title_key text) TO service_role;


--
-- Name: FUNCTION set_my_birthday(birthday_param date); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_my_birthday(birthday_param date) TO anon;
GRANT ALL ON FUNCTION public.set_my_birthday(birthday_param date) TO authenticated;
GRANT ALL ON FUNCTION public.set_my_birthday(birthday_param date) TO service_role;


--
-- Name: FUNCTION set_my_role_department(role_param text, department_param text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_my_role_department(role_param text, department_param text) TO anon;
GRANT ALL ON FUNCTION public.set_my_role_department(role_param text, department_param text) TO authenticated;
GRANT ALL ON FUNCTION public.set_my_role_department(role_param text, department_param text) TO service_role;


--
-- Name: FUNCTION set_user_admin(target_user uuid, value boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_user_admin(target_user uuid, value boolean) TO anon;
GRANT ALL ON FUNCTION public.set_user_admin(target_user uuid, value boolean) TO authenticated;
GRANT ALL ON FUNCTION public.set_user_admin(target_user uuid, value boolean) TO service_role;


--
-- Name: FUNCTION set_user_department(target_user uuid, dept text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_user_department(target_user uuid, dept text) TO anon;
GRANT ALL ON FUNCTION public.set_user_department(target_user uuid, dept text) TO authenticated;
GRANT ALL ON FUNCTION public.set_user_department(target_user uuid, dept text) TO service_role;


--
-- Name: FUNCTION set_user_permissions(target_user uuid, perms text[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_user_permissions(target_user uuid, perms text[]) TO anon;
GRANT ALL ON FUNCTION public.set_user_permissions(target_user uuid, perms text[]) TO authenticated;
GRANT ALL ON FUNCTION public.set_user_permissions(target_user uuid, perms text[]) TO service_role;


--
-- Name: FUNCTION submit_quiz_answer(question_id_param uuid, selected_index_param integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.submit_quiz_answer(question_id_param uuid, selected_index_param integer) TO anon;
GRANT ALL ON FUNCTION public.submit_quiz_answer(question_id_param uuid, selected_index_param integer) TO authenticated;
GRANT ALL ON FUNCTION public.submit_quiz_answer(question_id_param uuid, selected_index_param integer) TO service_role;


--
-- Name: FUNCTION touch_presence(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.touch_presence() TO anon;
GRANT ALL ON FUNCTION public.touch_presence() TO authenticated;
GRANT ALL ON FUNCTION public.touch_presence() TO service_role;


--
-- Name: FUNCTION trigger_birthday_emails(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.trigger_birthday_emails() FROM PUBLIC;
GRANT ALL ON FUNCTION public.trigger_birthday_emails() TO service_role;


--
-- Name: FUNCTION update_challenge_score(challenge_id_param uuid, score_param integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_challenge_score(challenge_id_param uuid, score_param integer) TO anon;
GRANT ALL ON FUNCTION public.update_challenge_score(challenge_id_param uuid, score_param integer) TO authenticated;
GRANT ALL ON FUNCTION public.update_challenge_score(challenge_id_param uuid, score_param integer) TO service_role;


--
-- Name: FUNCTION validate_role_department(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_role_department() TO anon;
GRANT ALL ON FUNCTION public.validate_role_department() TO authenticated;
GRANT ALL ON FUNCTION public.validate_role_department() TO service_role;


--
-- Name: FUNCTION viewer_is_admin(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.viewer_is_admin() TO anon;
GRANT ALL ON FUNCTION public.viewer_is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.viewer_is_admin() TO service_role;


--
-- Name: FUNCTION wordle_guess(guess_word text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.wordle_guess(guess_word text) TO anon;
GRANT ALL ON FUNCTION public.wordle_guess(guess_word text) TO authenticated;
GRANT ALL ON FUNCTION public.wordle_guess(guess_word text) TO service_role;


--
-- Name: FUNCTION wordle_today_word(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.wordle_today_word() FROM PUBLIC;
GRANT ALL ON FUNCTION public.wordle_today_word() TO anon;
GRANT ALL ON FUNCTION public.wordle_today_word() TO authenticated;
GRANT ALL ON FUNCTION public.wordle_today_word() TO service_role;


--
-- Name: TABLE accessory_catalog; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.accessory_catalog TO anon;
GRANT ALL ON TABLE public.accessory_catalog TO authenticated;
GRANT ALL ON TABLE public.accessory_catalog TO service_role;


--
-- Name: TABLE achievements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.achievements TO anon;
GRANT ALL ON TABLE public.achievements TO authenticated;
GRANT ALL ON TABLE public.achievements TO service_role;


--
-- Name: TABLE bet_options; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.bet_options TO anon;
GRANT ALL ON TABLE public.bet_options TO authenticated;
GRANT ALL ON TABLE public.bet_options TO service_role;


--
-- Name: TABLE bet_wagers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.bet_wagers TO anon;
GRANT ALL ON TABLE public.bet_wagers TO authenticated;
GRANT ALL ON TABLE public.bet_wagers TO service_role;


--
-- Name: TABLE bets; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.bets TO anon;
GRANT ALL ON TABLE public.bets TO authenticated;
GRANT ALL ON TABLE public.bets TO service_role;


--
-- Name: TABLE birthday_email_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.birthday_email_log TO anon;
GRANT ALL ON TABLE public.birthday_email_log TO authenticated;
GRANT ALL ON TABLE public.birthday_email_log TO service_role;


--
-- Name: TABLE birthday_email_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.birthday_email_settings TO anon;
GRANT ALL ON TABLE public.birthday_email_settings TO authenticated;
GRANT ALL ON TABLE public.birthday_email_settings TO service_role;


--
-- Name: TABLE birthday_notification_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.birthday_notification_log TO anon;
GRANT ALL ON TABLE public.birthday_notification_log TO authenticated;
GRANT ALL ON TABLE public.birthday_notification_log TO service_role;


--
-- Name: TABLE border_catalog; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.border_catalog TO anon;
GRANT ALL ON TABLE public.border_catalog TO authenticated;
GRANT ALL ON TABLE public.border_catalog TO service_role;


--
-- Name: TABLE challenge_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.challenge_events TO anon;
GRANT ALL ON TABLE public.challenge_events TO authenticated;
GRANT ALL ON TABLE public.challenge_events TO service_role;


--
-- Name: TABLE challenge_participants; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.challenge_participants TO anon;
GRANT ALL ON TABLE public.challenge_participants TO authenticated;
GRANT ALL ON TABLE public.challenge_participants TO service_role;


--
-- Name: TABLE challenge_score_updates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.challenge_score_updates TO anon;
GRANT ALL ON TABLE public.challenge_score_updates TO authenticated;
GRANT ALL ON TABLE public.challenge_score_updates TO service_role;


--
-- Name: TABLE challenge_terms_history; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.challenge_terms_history TO anon;
GRANT ALL ON TABLE public.challenge_terms_history TO authenticated;
GRANT ALL ON TABLE public.challenge_terms_history TO service_role;


--
-- Name: TABLE challenges; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.challenges TO anon;
GRANT ALL ON TABLE public.challenges TO authenticated;
GRANT ALL ON TABLE public.challenges TO service_role;


--
-- Name: TABLE comments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.comments TO anon;
GRANT ALL ON TABLE public.comments TO authenticated;
GRANT ALL ON TABLE public.comments TO service_role;


--
-- Name: TABLE direct_messages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.direct_messages TO anon;
GRANT ALL ON TABLE public.direct_messages TO authenticated;
GRANT ALL ON TABLE public.direct_messages TO service_role;


--
-- Name: TABLE dm_conversations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.dm_conversations TO anon;
GRANT ALL ON TABLE public.dm_conversations TO authenticated;
GRANT ALL ON TABLE public.dm_conversations TO service_role;


--
-- Name: TABLE goal_updates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.goal_updates TO anon;
GRANT ALL ON TABLE public.goal_updates TO authenticated;
GRANT ALL ON TABLE public.goal_updates TO service_role;


--
-- Name: TABLE goals; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.goals TO anon;
GRANT ALL ON TABLE public.goals TO authenticated;
GRANT ALL ON TABLE public.goals TO service_role;


--
-- Name: TABLE hof_award_categories; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.hof_award_categories TO anon;
GRANT ALL ON TABLE public.hof_award_categories TO authenticated;
GRANT ALL ON TABLE public.hof_award_categories TO service_role;


--
-- Name: TABLE hof_award_winners; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.hof_award_winners TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.hof_award_winners TO authenticated;
GRANT ALL ON TABLE public.hof_award_winners TO service_role;


--
-- Name: TABLE hof_categories; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.hof_categories TO anon;
GRANT ALL ON TABLE public.hof_categories TO authenticated;
GRANT ALL ON TABLE public.hof_categories TO service_role;


--
-- Name: TABLE hof_deletion_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.hof_deletion_logs TO service_role;
GRANT SELECT ON TABLE public.hof_deletion_logs TO authenticated;


--
-- Name: TABLE hof_podium_exclusions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.hof_podium_exclusions TO anon;
GRANT ALL ON TABLE public.hof_podium_exclusions TO authenticated;
GRANT ALL ON TABLE public.hof_podium_exclusions TO service_role;


--
-- Name: TABLE hof_records; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.hof_records TO anon;
GRANT ALL ON TABLE public.hof_records TO authenticated;
GRANT ALL ON TABLE public.hof_records TO service_role;


--
-- Name: TABLE login_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.login_sessions TO anon;
GRANT ALL ON TABLE public.login_sessions TO authenticated;
GRANT ALL ON TABLE public.login_sessions TO service_role;


--
-- Name: TABLE mentorships; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mentorships TO anon;
GRANT ALL ON TABLE public.mentorships TO authenticated;
GRANT ALL ON TABLE public.mentorships TO service_role;


--
-- Name: TABLE mission_activity; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mission_activity TO anon;
GRANT ALL ON TABLE public.mission_activity TO authenticated;
GRANT ALL ON TABLE public.mission_activity TO service_role;


--
-- Name: SEQUENCE mission_activity_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.mission_activity_id_seq TO anon;
GRANT ALL ON SEQUENCE public.mission_activity_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.mission_activity_id_seq TO service_role;


--
-- Name: TABLE mission_claims; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mission_claims TO anon;
GRANT ALL ON TABLE public.mission_claims TO authenticated;
GRANT ALL ON TABLE public.mission_claims TO service_role;


--
-- Name: TABLE missions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.missions TO anon;
GRANT ALL ON TABLE public.missions TO authenticated;
GRANT ALL ON TABLE public.missions TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: TABLE org_departments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_departments TO anon;
GRANT ALL ON TABLE public.org_departments TO authenticated;
GRANT ALL ON TABLE public.org_departments TO service_role;


--
-- Name: TABLE org_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_roles TO anon;
GRANT ALL ON TABLE public.org_roles TO authenticated;
GRANT ALL ON TABLE public.org_roles TO service_role;


--
-- Name: TABLE pk_money_debts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.pk_money_debts TO anon;
GRANT ALL ON TABLE public.pk_money_debts TO authenticated;
GRANT ALL ON TABLE public.pk_money_debts TO service_role;


--
-- Name: TABLE pk_playbooks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.pk_playbooks TO anon;
GRANT ALL ON TABLE public.pk_playbooks TO authenticated;
GRANT ALL ON TABLE public.pk_playbooks TO service_role;


--
-- Name: TABLE pk_points; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.pk_points TO anon;
GRANT ALL ON TABLE public.pk_points TO authenticated;
GRANT ALL ON TABLE public.pk_points TO service_role;


--
-- Name: TABLE pk_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.pk_settings TO anon;
GRANT ALL ON TABLE public.pk_settings TO authenticated;
GRANT ALL ON TABLE public.pk_settings TO service_role;


--
-- Name: TABLE point_transactions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.point_transactions TO anon;
GRANT ALL ON TABLE public.point_transactions TO authenticated;
GRANT ALL ON TABLE public.point_transactions TO service_role;


--
-- Name: TABLE points_maintenance_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.points_maintenance_log TO anon;
GRANT ALL ON TABLE public.points_maintenance_log TO authenticated;
GRANT ALL ON TABLE public.points_maintenance_log TO service_role;


--
-- Name: TABLE points_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.points_settings TO anon;
GRANT ALL ON TABLE public.points_settings TO authenticated;
GRANT ALL ON TABLE public.points_settings TO service_role;


--
-- Name: TABLE posts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.posts TO anon;
GRANT ALL ON TABLE public.posts TO authenticated;
GRANT ALL ON TABLE public.posts TO service_role;


--
-- Name: TABLE progress_photos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.progress_photos TO anon;
GRANT ALL ON TABLE public.progress_photos TO authenticated;
GRANT ALL ON TABLE public.progress_photos TO service_role;


--
-- Name: TABLE push_subscriptions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.push_subscriptions TO anon;
GRANT ALL ON TABLE public.push_subscriptions TO authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO service_role;


--
-- Name: TABLE quiz_answers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.quiz_answers TO anon;
GRANT ALL ON TABLE public.quiz_answers TO authenticated;
GRANT ALL ON TABLE public.quiz_answers TO service_role;


--
-- Name: TABLE quiz_questions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.quiz_questions TO anon;
GRANT ALL ON TABLE public.quiz_questions TO authenticated;
GRANT ALL ON TABLE public.quiz_questions TO service_role;


--
-- Name: TABLE reactions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.reactions TO anon;
GRANT ALL ON TABLE public.reactions TO authenticated;
GRANT ALL ON TABLE public.reactions TO service_role;


--
-- Name: TABLE reward_redemptions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.reward_redemptions TO anon;
GRANT ALL ON TABLE public.reward_redemptions TO authenticated;
GRANT ALL ON TABLE public.reward_redemptions TO service_role;


--
-- Name: TABLE rewards; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.rewards TO anon;
GRANT ALL ON TABLE public.rewards TO authenticated;
GRANT ALL ON TABLE public.rewards TO service_role;


--
-- Name: TABLE voice_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.voice_sessions TO anon;
GRANT ALL ON TABLE public.voice_sessions TO authenticated;
GRANT ALL ON TABLE public.voice_sessions TO service_role;


--
-- Name: TABLE wordle_attempts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.wordle_attempts TO anon;
GRANT ALL ON TABLE public.wordle_attempts TO authenticated;
GRANT ALL ON TABLE public.wordle_attempts TO service_role;


--
-- Name: TABLE wordle_results; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.wordle_results TO anon;
GRANT ALL ON TABLE public.wordle_results TO authenticated;
GRANT ALL ON TABLE public.wordle_results TO service_role;


--
-- Name: TABLE wordle_valid_guesses; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.wordle_valid_guesses TO anon;
GRANT ALL ON TABLE public.wordle_valid_guesses TO authenticated;
GRANT ALL ON TABLE public.wordle_valid_guesses TO service_role;


--
-- Name: TABLE wordle_words; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.wordle_words TO anon;
GRANT ALL ON TABLE public.wordle_words TO authenticated;
GRANT ALL ON TABLE public.wordle_words TO service_role;


--
-- Name: SEQUENCE wordle_words_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.wordle_words_id_seq TO anon;
GRANT ALL ON SEQUENCE public.wordle_words_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.wordle_words_id_seq TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict ZNGcg2LSqIekA2icUsJqFvwvpUoIxNGp2gtPl3aNMZ7sJ5PO0YSjvZjyIG5sbSa

