-- Lets an admin, or anyone holding the manage_hall_of_fame permission, delete
-- a Guinness Record entry (e.g. a mistaken or test submission).
alter table hof_records enable row level security;

drop policy if exists "hof_records_delete_managers" on hof_records;
create policy "hof_records_delete_managers"
  on hof_records for delete
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and (is_admin = true or 'manage_hall_of_fame' = any(permissions))
    )
  );
