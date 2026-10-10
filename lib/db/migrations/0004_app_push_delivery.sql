create table if not exists public.app_push_outbox (
  id bigserial primary key,
  notification_id uuid not null unique references public.notifications(id) on delete cascade,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists app_push_outbox_pending_idx
  on public.app_push_outbox(next_attempt_at,id) where processed_at is null;

create or replace function public.enqueue_app_push_notification()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from public.push_subscriptions where user_id=new.user_id) then
    insert into public.app_push_outbox(notification_id) values(new.id) on conflict(notification_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_notification_push on public.notifications;
drop function if exists public.push_new_notification();
create trigger on_notification_push after insert on public.notifications
  for each row execute function public.enqueue_app_push_notification();
