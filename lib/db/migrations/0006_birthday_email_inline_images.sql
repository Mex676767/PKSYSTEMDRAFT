alter table public.birthday_email_settings
  add column if not exists announcement_image_url text not null default '',
  add column if not exists personal_image_url text not null default '';
