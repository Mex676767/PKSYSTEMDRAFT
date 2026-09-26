-- Make gratitude letters arrive live for recipients and the public wall.
-- Apply this migration to both the C9MYR and C6 Supabase projects.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'gratitude_letters'
  ) then
    alter publication supabase_realtime add table public.gratitude_letters;
  end if;
end;
$$;

commit;
