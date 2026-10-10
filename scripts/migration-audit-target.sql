-- Read-only destination inventory. Run separately against employee_hub_c9
-- and employee_hub_c6 after import and API foundation migrations.
BEGIN READ ONLY;

SELECT current_database() AS connected_database, current_user AS connected_role;

-- Exact row counts for each imported application table.
SELECT t.table_name,
       (xpath('/table/row/row_count/text()',
         query_to_xml(format('select count(*) as row_count from %I.%I', t.table_schema, t.table_name), false, true, '')))[1]::text::bigint AS row_count
  FROM information_schema.tables t
 WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
 ORDER BY t.table_name;

-- Counts match the source report shape wherever the table was imported.
SELECT count(*) AS profiles,
       count(*) FILTER (WHERE is_deleted) AS deleted_profiles,
       count(*) FILTER (WHERE is_admin) AS administrators
  FROM public.profiles;
SELECT count(*) AS approval_rows,
       count(*) FILTER (WHERE approved_at IS NOT NULL) AS approved,
       count(*) FILTER (WHERE approved_at IS NULL) AS pending
  FROM public.account_approvals;
SELECT award_type, count(*) AS categories
  FROM public.hof_award_categories GROUP BY award_type ORDER BY award_type;
SELECT count(*) AS winners,
       count(*) FILTER (WHERE cardinality(coalesce(team_member_ids, '{}'::uuid[])) > 0) AS team_leaders_with_members
  FROM public.hof_award_winners;
SELECT count(*) AS winners_with_missing_leader_profile
  FROM public.hof_award_winners w LEFT JOIN public.profiles p ON p.id = w.user_id
 WHERE p.id IS NULL;
SELECT count(*) AS missing_team_member_profiles
  FROM public.hof_award_winners w
 CROSS JOIN LATERAL unnest(coalesce(w.team_member_ids, '{}'::uuid[])) AS members(id)
  LEFT JOIN public.profiles p ON p.id = members.id
 WHERE p.id IS NULL;
SELECT count(*) AS team_place_ties FROM (
  SELECT w.category_id, w.month, w.rank
    FROM public.hof_award_winners w
    JOIN public.hof_award_categories c ON c.id = w.category_id
   WHERE c.award_type = 'team'
   GROUP BY w.category_id, w.month, w.rank HAVING count(*) > 1
) ties;
SELECT count(*) AS individual_tie_groups FROM (
  SELECT w.category_id, w.month, w.rank
    FROM public.hof_award_winners w
    JOIN public.hof_award_categories c ON c.id = w.category_id
   WHERE c.award_type = 'individual'
   GROUP BY w.category_id, w.month, w.rank HAVING count(*) > 1
) ties;
SELECT count(*) AS individual_rows_with_team_members
  FROM public.hof_award_winners w
  JOIN public.hof_award_categories c ON c.id = w.category_id
 WHERE c.award_type = 'individual'
   AND cardinality(coalesce(w.team_member_ids, '{}'::uuid[])) > 0;

-- These tables begin empty and are excluded from the Supabase source counts.
SELECT count(*) AS api_sessions FROM public.api_sessions;
SELECT count(*) AS api_password_credentials FROM public.api_password_credentials;
SELECT count(*) AS api_oauth_identities FROM public.api_oauth_identities;

COMMIT;
