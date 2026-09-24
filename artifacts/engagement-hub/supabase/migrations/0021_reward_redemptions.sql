-- Points revamp, part 5: spending points in the rewards shop. Points are taken
-- when someone redeems; an admin then marks it fulfilled, or rejects it and
-- the points (and stock) go back.

create or replace function redeem_reward(reward_id_param uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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
grant execute on function redeem_reward(uuid) to authenticated;

create or replace function admin_review_redemption(redemption_id_param uuid, approve boolean, note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
grant execute on function admin_review_redemption(uuid, boolean, text) to authenticated;

-- Re-create the points notification from 0016 so it stays quiet for ledger
-- changes that already send their own message (missions, rewards, refunds).
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
    values (new.id, null, 'achievement', 'profile', new.id, 'Achievement unlocked: ' || initcap(replace(t, '_', ' ')));
  end loop;
  return new;
end;
$$;
