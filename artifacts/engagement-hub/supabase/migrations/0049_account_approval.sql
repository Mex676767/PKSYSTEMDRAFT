-- New accounts must be approved by an existing administrator before they can
-- use the hub. Existing profiles are grandfathered in during this migration.
-- Run this migration in both the C9MYR and C6 Supabase projects.

begin;

create table if not exists public.account_approvals (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.account_approvals enable row level security;
revoke all on public.account_approvals from anon, authenticated;

-- Profiles previously had table-wide UPDATE permission. Limit normal users to
-- the two fields the client edits directly; privileged changes stay in the
-- existing security-definer admin/customisation functions.
revoke update on public.profiles from authenticated;
grant update (username, avatar_url) on public.profiles to authenticated;

-- Everyone who existed before the approval feature was deployed remains
-- approved. Accounts created after that deployment stay pending even when an
-- organisation applies this migration later.
insert into public.account_approvals (user_id, approved_at)
select id, now()
from public.profiles
where created_at < timestamptz '2026-09-25 15:36:10+00'
on conflict (user_id) do update
set approved_at = coalesce(public.account_approvals.approved_at, excluded.approved_at);

-- Ensure profiles created during the gap between the frontend deployment and
-- this migration also get a pending approval row.
insert into public.account_approvals (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

create or replace function public.create_pending_account_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.account_approvals (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.create_pending_account_approval() from public;

drop trigger if exists create_pending_account_approval on public.profiles;
create trigger create_pending_account_approval
after insert on public.profiles
for each row execute function public.create_pending_account_approval();

create or replace function public.is_approved_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.account_approvals a
    join public.profiles p on p.id = a.user_id
    where a.user_id = auth.uid()
      and a.approved_at is not null
      and p.is_deleted = false
  );
$$;
revoke all on function public.is_approved_user() from public;
grant execute on function public.is_approved_user() to authenticated;

create or replace function public.get_my_approval_status()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_approved_user();
$$;
revoke all on function public.get_my_approval_status() from public;
grant execute on function public.get_my_approval_status() to authenticated;

create or replace function public.admin_list_profile_approvals()
returns table (user_id uuid, approved_at timestamptz, approved_by uuid)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.viewer_is_admin() or not public.is_approved_user() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return query
    select p.id, a.approved_at, a.approved_by
    from public.profiles p
    left join public.account_approvals a on a.user_id = p.id;
end;
$$;
revoke all on function public.admin_list_profile_approvals() from public;
grant execute on function public.admin_list_profile_approvals() to authenticated;

create or replace function public.admin_approve_user(target_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.viewer_is_admin() or not public.is_approved_user() then
    raise exception 'Only an approved administrator can approve accounts.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = target_user and is_deleted = false) then
    raise exception 'User not found or deactivated.';
  end if;

  insert into public.account_approvals (user_id, approved_at, approved_by)
  values (target_user, now(), auth.uid())
  on conflict (user_id) do update
  set approved_at = coalesce(public.account_approvals.approved_at, excluded.approved_at),
      approved_by = case
        when public.account_approvals.approved_at is null then excluded.approved_by
        else public.account_approvals.approved_by
      end;
end;
$$;
revoke all on function public.admin_approve_user(uuid) from public;
grant execute on function public.admin_approve_user(uuid) to authenticated;

-- A pending account can read only its own profile, which is needed to render
-- the waiting screen. Every other RLS-protected app table requires approval.
do $$
declare table_name text;
begin
  for table_name in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity
      and c.relname <> 'account_approvals'
  loop
    execute format('drop policy if exists approved_accounts_only on public.%I', table_name);
    if table_name = 'profiles' then
      execute 'create policy approved_accounts_only on public.profiles as restrictive for all to authenticated using (id = auth.uid() or public.is_approved_user()) with check (id = auth.uid() or public.is_approved_user())';
    else
      execute format('create policy approved_accounts_only on public.%I as restrictive for all to authenticated using (public.is_approved_user()) with check (public.is_approved_user())', table_name);
    end if;
  end loop;
end;
$$;

-- Close the main helper paths used by privileged app actions as well.
create or replace function public.viewer_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_approved_user()
    and coalesce((select is_admin from public.profiles where id = auth.uid() and is_deleted = false), false);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_approved_user()
    and coalesce((select is_admin from public.profiles where id = auth.uid() and is_deleted = false), false);
$$;

create or replace function public.is_points_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_approved_user()
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true and is_deleted = false);
$$;

create or replace function public.has_permission(perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_approved_user() and coalesce(
    (select is_admin or perm = any(permissions) from public.profiles where id = auth.uid() and is_deleted = false),
    false
  );
$$;

-- Pending accounts must not be able to upload into the shared photo bucket.
drop policy if exists "Approved users can use post images" on storage.objects;
create policy "Approved users can use post images" on storage.objects
as restrictive for all to authenticated
using (bucket_id <> 'post-images' or public.is_approved_user())
with check (bucket_id <> 'post-images' or public.is_approved_user());

notify pgrst, 'reload schema';
commit;
