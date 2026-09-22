alter table goals
  add column if not exists action_plan text;

create table if not exists goal_updates (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  progress integer not null check (progress >= 0 and progress <= 100),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists goal_updates_goal_id_idx on goal_updates(goal_id, created_at desc);

alter table goal_updates enable row level security;

drop policy if exists "goal_updates_select_authenticated" on goal_updates;
create policy "goal_updates_select_authenticated"
  on goal_updates for select
  to authenticated
  using (true);

drop policy if exists "goal_updates_insert_own" on goal_updates;
create policy "goal_updates_insert_own"
  on goal_updates for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (select 1 from goals where goals.id = goal_id and goals.owner_id = auth.uid())
  );

drop policy if exists "goal_updates_delete_own_or_admin" on goal_updates;
create policy "goal_updates_delete_own_or_admin"
  on goal_updates for delete
  to authenticated
  using (
    author_id = auth.uid()
    or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true)
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'goal_updates'
  ) then
    alter publication supabase_realtime add table goal_updates;
  end if;
end $$;
