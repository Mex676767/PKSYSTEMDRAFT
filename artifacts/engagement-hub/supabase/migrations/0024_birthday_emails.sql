-- Birthday emails: a personal email to the birthday person as well as the
-- team announcement, plus when to send and a log. Sending is done by the
-- send-birthday-emails edge function (see supabase/BIRTHDAY-EMAILS.md); it
-- runs hourly and only sends once the configured local hour is reached.
-- Personal placeholders: {{name}}, {{date}}, {{site_url}}.

alter table birthday_email_settings
  add column if not exists personal_enabled boolean not null default false,
  add column if not exists personal_subject text not null default 'Happy birthday, {{name}}! 🎂',
  add column if not exists personal_body text not null default
    E'Hi {{name}},\n\nHappy birthday from all of us! 🎉 We hope your day is as awesome as you are.\n\nYour teammates are leaving you wishes on the hub:\n{{site_url}}/birthdays\n\nEnjoy your day,\nC9MYR Hub',
  add column if not exists site_url text not null default '',
  add column if not exists send_hour smallint not null default 8 check (send_hour between 0 and 23),
  add column if not exists timezone text not null default 'Asia/Kuala_Lumpur';

-- One row per birthday person, day and email kind: makes hourly runs send
-- once. A failed row is retried on the next run.
create table if not exists birthday_email_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  birthday_on date not null,
  kind text not null check (kind in ('announcement', 'personal')),
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  recipients integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  unique (profile_id, birthday_on, kind)
);

alter table birthday_email_log enable row level security;

drop policy if exists "birthday_email_log_admin_select" on birthday_email_log;
create policy "birthday_email_log_admin_select"
  on birthday_email_log for select
  to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

-- Hourly call to the edge function, using the same Vault secrets as push
-- notifications (project_url, push_webhook_secret). Does nothing until those
-- exist; the function itself does nothing until an email is switched on.
create or replace function trigger_birthday_emails()
returns void
language plpgsql
security definer
set search_path = public
as $$
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

revoke all on function trigger_birthday_emails() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'birthday-emails') then
    perform cron.unschedule('birthday-emails');
  end if;
  perform cron.schedule('birthday-emails', '10 * * * *', 'select trigger_birthday_emails()');
exception when others then
  raise warning 'pg_cron unavailable, birthday emails not scheduled: %', sqlerrm;
end;
$$;
