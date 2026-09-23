-- Replaces the entire paid profile-cosmetics catalog (borders + accessories)
-- with a new free-for-everyone set. Nothing here touches profiles.points or
-- any point_transactions history -- equipping a cosmetic never spends points.

-- 1. Empty out the old paid catalog tables. The client no longer reads them
--    (the new catalog is a static list shipped in the frontend), so this just
--    prevents anything stale from lingering if they're ever queried directly.
truncate table border_catalog;
truncate table accessory_catalog;

-- 2. Re-create the equip RPCs to validate against the new key set directly,
--    with no ownership/points gate -- every employee can equip any of the
--    new items immediately.
create or replace function set_active_border(border_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

grant execute on function set_active_border(text) to authenticated;

create or replace function set_active_accessory(accessory_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

grant execute on function set_active_accessory(text) to authenticated;

-- 3. Anyone with an old (now-removed) cosmetic equipped falls back to none,
--    rather than rendering nothing/broken. Points and unlocked_* history are
--    left untouched.
update profiles set active_border = null
where active_border is not null and active_border not in (
  'cosmic-orbit', 'pixel-glitch', 'electric-pulse', 'sakura-bloom',
  'trophy-halo', 'crystal-prism', 'meteor-trail', 'galaxy-crown'
);

update profiles set active_accessory = null
where active_accessory is not null and active_accessory not in (
  'angel-wings', 'neon-headphones', 'rocket-pack', 'wizard-hat', 'cyber-cat-ears',
  'lightning-bolt-aura', 'floating-hearts', 'pixel-sword', 'mini-planet', 'champion-laurel'
);

-- 4. The old purchase RPCs are dead now that cosmetics are free; drop them if
--    present so nothing can accidentally deduct points for a cosmetic again.
drop function if exists purchase_border(text);
drop function if exists purchase_accessory(text);
