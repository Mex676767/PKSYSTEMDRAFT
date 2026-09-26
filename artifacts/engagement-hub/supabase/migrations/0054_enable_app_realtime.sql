-- Enable live UI updates for every database-backed area of the app.
-- Apply this migration to both the C9MYR and C6 Supabase projects.

begin;

-- Pending users may listen only to their own approval row. This lets the
-- waiting screen unlock immediately after an administrator approves them.
grant select on public.account_approvals to authenticated;
drop policy if exists account_approvals_read_own on public.account_approvals;
create policy account_approvals_read_own on public.account_approvals
for select to authenticated using (user_id = auth.uid());

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles', 'account_approvals',
    'posts', 'comments', 'reactions',
    'goals', 'goal_updates', 'progress_photos',
    'notifications', 'dm_conversations', 'direct_messages',
    'challenges', 'challenge_participants', 'challenge_terms_history',
    'challenge_events', 'challenge_score_updates',
    'pk_settings', 'pk_violations', 'pk_playbooks', 'pk_points',
    'pk_money_debts', 'pk_approval_requirements', 'pk_point_ledger',
    'pk_streaks', 'pk_monthly_bans', 'pk_ranking_groups', 'pk_monthly_seasons',
    'hof_categories', 'hof_records', 'hof_award_categories',
    'hof_award_winners', 'hof_deletion_logs',
    'org_roles', 'org_departments', 'mentorships',
    'learning_resources', 'learning_requests', 'learning_shares',
    'gratitude_letters', 'achievements',
    'birthday_email_settings', 'birthday_email_log',
    'points_settings', 'point_transactions', 'missions', 'mission_claims',
    'rewards', 'reward_redemptions',
    'bets', 'bet_options', 'bet_wagers',
    'quiz_questions', 'quiz_answers',
    'wordle_attempts', 'wordle_results',
    'login_sessions', 'voice_sessions', 'discord_presence'
  ] loop
    if to_regclass('public.' || table_name) is not null
      and not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;

commit;
