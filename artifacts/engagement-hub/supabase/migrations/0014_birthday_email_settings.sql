-- Settings for the automatic birthday announcement email, edited from the
-- admin panel. A single row (id = 1). The sending job itself isn't built yet;
-- when it is, it reads this row (with the service role) and only sends when
-- `enabled` is true.
--
-- Placeholders the job will fill in, in both subject and body:
--   {{names}}     everyone with a birthday today, e.g. "@aldo and @max"
--   {{date}}      today's date, e.g. "24 September"
--   {{site_url}}  link back to the hub
create table if not exists birthday_email_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default false,
  from_name text not null default 'C9MYR Hub',
  from_email text not null default '',
  reply_to text not null default '',
  subject text not null default 'Happy birthday, {{names}}! 🎂',
  body text not null default
    E'Hi team,\n\nToday is {{names}}''s birthday! 🎉\n\nDrop by the hub and leave them a birthday wish:\n{{site_url}}/birthdays\n\nHave a great day,\nC9MYR Hub',
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into birthday_email_settings (id) values (1) on conflict (id) do nothing;

alter table birthday_email_settings enable row level security;

drop policy if exists "birthday_email_settings_admin_select" on birthday_email_settings;
create policy "birthday_email_settings_admin_select"
  on birthday_email_settings for select
  to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

drop policy if exists "birthday_email_settings_admin_update" on birthday_email_settings;
create policy "birthday_email_settings_admin_update"
  on birthday_email_settings for update
  to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (id = 1 and exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

-- Stamp who changed it and when, whatever the client sends.
create or replace function birthday_email_settings_stamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists on_birthday_email_settings_update on birthday_email_settings;
create trigger on_birthday_email_settings_update
  before update on birthday_email_settings
  for each row
  execute function birthday_email_settings_stamp();
