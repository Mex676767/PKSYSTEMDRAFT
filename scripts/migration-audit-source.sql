-- Read-only source inventory. Run separately against C9 and C6 immediately
-- before each export. Save each result under a tenant-specific filename.
BEGIN READ ONLY;

SELECT current_database() AS connected_database, current_user AS connected_role;

-- Exact row counts for every source application table.
SELECT t.table_name,
       (xpath('/table/row/row_count/text()',
         query_to_xml(format('select count(*) as row_count from %I.%I', t.table_schema, t.table_name), false, true, '')))[1]::text::bigint AS row_count
  FROM information_schema.tables t
 WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
 ORDER BY t.table_name;

-- Auth inventory contains counts and hash format markers only, never hashes.
SELECT count(*) AS auth_users FROM auth.users;
SELECT CASE
         WHEN encrypted_password LIKE '$2a$%' THEN 'bcrypt-2a'
         WHEN encrypted_password LIKE '$2b$%' THEN 'bcrypt-2b'
         WHEN encrypted_password LIKE '$2y$%' THEN 'bcrypt-2y'
         WHEN coalesce(encrypted_password, '') = '' THEN 'no-password-hash'
         ELSE 'other-format'
       END AS password_hash_format,
       count(*) AS users
  FROM auth.users
 GROUP BY 1 ORDER BY 1;
SELECT coalesce(provider, 'unknown') AS provider, count(*) AS identities
  FROM auth.identities GROUP BY 1 ORDER BY 1;

-- Asset inventory by bucket (no object names or URLs).
SELECT bucket_id, count(*) AS objects
  FROM storage.objects GROUP BY bucket_id ORDER BY bucket_id;

-- Representative user, approval and Hall of Fame checks.
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

COMMIT;
