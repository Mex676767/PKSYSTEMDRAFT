-- Apply this migration to both the C9MYR and C6 Supabase projects.
-- pg_cron retains every execution record indefinitely unless it is pruned.
-- Keeping 30 days is enough for troubleshooting without allowing the system
-- table to grow forever on the small production instances.

do $$
begin
  delete from cron.job_run_details
  where end_time < now() - interval '30 days';

  if exists (select 1 from cron.job where jobname = 'maintenance-prune-cron-history') then
    perform cron.unschedule('maintenance-prune-cron-history');
  end if;

  perform cron.schedule(
    'maintenance-prune-cron-history',
    '30 3 * * 0',
    $job$delete from cron.job_run_details where end_time < now() - interval '30 days'$job$
  );
exception
  when undefined_table or undefined_function or insufficient_privilege then
    raise warning 'pg_cron history maintenance was not installed: %', sqlerrm;
end
$$;
