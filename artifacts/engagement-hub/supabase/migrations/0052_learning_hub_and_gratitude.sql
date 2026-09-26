-- Learning Hub and public gratitude letters.
-- Apply this migration to both the C9MYR and C6 Supabase projects.

begin;

create table if not exists public.learning_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 140),
  description text not null default '' check (char_length(description) <= 2000),
  category text not null default 'General' check (char_length(trim(category)) between 2 and 60),
  url text check (url is null or char_length(url) <= 1000),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.learning_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_name text not null check (char_length(trim(course_name)) between 2 and 160),
  course_url text check (course_url is null or char_length(course_url) <= 1000),
  reason text not null check (char_length(trim(reason)) between 2 and 2000),
  benefit text not null check (char_length(trim(benefit)) between 2 and 2000),
  estimated_cost numeric(12,2) check (estimated_cost is null or estimated_cost >= 0),
  status text not null default 'pending' check (status in ('pending', 'sponsored', 'declined')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.learning_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 160),
  learned text not null check (char_length(trim(learned)) between 2 and 3000),
  benefit text not null check (char_length(trim(benefit)) between 2 and 2000),
  resource_url text check (resource_url is null or char_length(resource_url) <= 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.gratitude_letters (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(trim(message)) between 2 and 2000),
  first_seen_at timestamptz,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index if not exists learning_resources_created_at_idx
  on public.learning_resources(created_at desc);
create index if not exists learning_requests_status_created_at_idx
  on public.learning_requests(status, created_at desc);
create index if not exists learning_shares_created_at_idx
  on public.learning_shares(created_at desc);
create index if not exists gratitude_letters_created_at_idx
  on public.gratitude_letters(created_at desc);
create index if not exists gratitude_letters_unseen_idx
  on public.gratitude_letters(recipient_id, created_at desc)
  where first_seen_at is null;

alter table public.learning_resources enable row level security;
alter table public.learning_requests enable row level security;
alter table public.learning_shares enable row level security;
alter table public.gratitude_letters enable row level security;

revoke all on public.learning_resources from anon, authenticated;
revoke all on public.learning_requests from anon, authenticated;
revoke all on public.learning_shares from anon, authenticated;
revoke all on public.gratitude_letters from anon, authenticated;

grant select on public.learning_resources to authenticated;
grant insert, update, delete on public.learning_resources to authenticated;
grant select, insert, update, delete on public.learning_requests to authenticated;
grant select, insert, delete on public.learning_shares to authenticated;
grant select, insert, delete on public.gratitude_letters to authenticated;
grant update (first_seen_at) on public.gratitude_letters to authenticated;

drop policy if exists approved_accounts_only on public.learning_resources;
create policy approved_accounts_only on public.learning_resources
as restrictive for all to authenticated
using (public.is_approved_user())
with check (public.is_approved_user());

drop policy if exists learning_resources_read on public.learning_resources;
create policy learning_resources_read on public.learning_resources
for select to authenticated using (true);

drop policy if exists learning_resources_manage on public.learning_resources;
create policy learning_resources_manage on public.learning_resources
for all to authenticated
using (public.has_permission('manage_learning'))
with check (public.has_permission('manage_learning'));

drop policy if exists approved_accounts_only on public.learning_requests;
create policy approved_accounts_only on public.learning_requests
as restrictive for all to authenticated
using (public.is_approved_user())
with check (public.is_approved_user());

drop policy if exists learning_requests_read on public.learning_requests;
create policy learning_requests_read on public.learning_requests
for select to authenticated using (true);

drop policy if exists learning_requests_create on public.learning_requests;
create policy learning_requests_create on public.learning_requests
for insert to authenticated with check (
  user_id = auth.uid()
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
);

drop policy if exists learning_requests_manage on public.learning_requests;
create policy learning_requests_manage on public.learning_requests
for update to authenticated
using (public.has_permission('manage_learning'))
with check (public.has_permission('manage_learning'));

drop policy if exists learning_requests_delete on public.learning_requests;
create policy learning_requests_delete on public.learning_requests
for delete to authenticated using (
  (user_id = auth.uid() and status = 'pending')
  or public.has_permission('manage_learning')
);

drop policy if exists approved_accounts_only on public.learning_shares;
create policy approved_accounts_only on public.learning_shares
as restrictive for all to authenticated
using (public.is_approved_user())
with check (public.is_approved_user());

drop policy if exists learning_shares_read on public.learning_shares;
create policy learning_shares_read on public.learning_shares
for select to authenticated using (true);

drop policy if exists learning_shares_create on public.learning_shares;
create policy learning_shares_create on public.learning_shares
for insert to authenticated with check (user_id = auth.uid());

drop policy if exists learning_shares_delete on public.learning_shares;
create policy learning_shares_delete on public.learning_shares
for delete to authenticated using (
  user_id = auth.uid() or public.has_permission('manage_learning')
);

drop policy if exists approved_accounts_only on public.gratitude_letters;
create policy approved_accounts_only on public.gratitude_letters
as restrictive for all to authenticated
using (public.is_approved_user())
with check (public.is_approved_user());

drop policy if exists gratitude_letters_read on public.gratitude_letters;
create policy gratitude_letters_read on public.gratitude_letters
for select to authenticated using (true);

drop policy if exists gratitude_letters_create on public.gratitude_letters;
create policy gratitude_letters_create on public.gratitude_letters
for insert to authenticated with check (
  sender_id = auth.uid() and recipient_id <> auth.uid()
);

drop policy if exists gratitude_letters_mark_seen on public.gratitude_letters;
create policy gratitude_letters_mark_seen on public.gratitude_letters
for update to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

drop policy if exists gratitude_letters_delete on public.gratitude_letters;
create policy gratitude_letters_delete on public.gratitude_letters
for delete to authenticated using (
  sender_id = auth.uid() or public.viewer_is_admin()
);

notify pgrst, 'reload schema';
commit;
