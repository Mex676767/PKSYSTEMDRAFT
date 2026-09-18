alter table discord_presence
  drop constraint if exists discord_presence_category_check;

alter table discord_presence
  add constraint discord_presence_category_check
  check (category in ('active', 'training', 'meeting', 'afk', 'break'));
